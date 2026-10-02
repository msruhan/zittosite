import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  Prisma,
  type AdminRole,
  type OrderChannel,
  type OrderStatus,
  type ResultStatus,
} from "@prisma/client";
import { processDurationLabel } from "./process-duration";
import { resolveUserPrice } from "./user-price";
import { userOrderNoticeHtml } from "../telegram/telegram-messages";
import { PrismaService } from "../prisma/prisma.service";
import { paymentSimulationEnabled, webPublicUrl } from "../config/env";
import { AdminNotifyService } from "../telegram/admin-notify.service";
import { AuditLogService } from "../security/audit-log.service";
import { WhatsappNotifyService } from "../whatsapp/whatsapp-notify.service";
import {
  SayabayarClient,
  type SayabayarInvoice,
} from "../payments/sayabayar.client";
import { serializeOrderListItem, serializeService } from "./orders.serializer";
import { parseImeiList } from "./imei-list";
import { NO_DEVICE_VALUE, parseOrderExtras } from "./special-fields";
import {
  type OrderVia,
  orderViaWhere,
  serviceViaWhere,
} from "./supplier-routed";
import { SupplierDispatch } from "./supplier-dispatch";
import { TopupService } from "./topup.service";
import { menuOfService } from "./user-menus";
import { UserMenusService } from "./user-menus.service";
import {
  applyBalance,
  InsufficientBalanceException,
  refundNote,
  refundOrderToBalance,
  type BalanceReason,
} from "./balance";

/** SayaBayar only accepts invoice lifetimes of 60 minutes or more. */
const INVOICE_TTL_MINUTES = 60;
const INVOICE_TTL_MS = INVOICE_TTL_MINUTES * 60 * 1000;

const CANCELLABLE_BY_ADMIN: OrderStatus[] = [
  "waiting_payment",
  "paid",
  "waiting_action",
  "in_process",
];

const orderInclude = {
  service: true,
  user: true,
  assignedAdmin: true,
  invoice: {
    include: {
      orders: {
        select: { orderId: true, imei: true, status: true },
        orderBy: { orderId: "asc" as const },
      },
    },
  },
  result: true,
  activity: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.OrderInclude;

/** Orders of Telegram-fulfilled services assigned to this operator. */
export function assignedServiceFilter(adminId: string) {
  return {
    service: {
      fulfillmentChannel: "telegram",
      assignments: { some: { adminId } },
    },
  } satisfies Prisma.OrderWhereInput;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminNotify: AdminNotifyService,
    private readonly sayabayar: SayabayarClient,
    private readonly audit: AuditLogService,
    private readonly whatsappNotify: WhatsappNotifyService,
    private readonly topups: TopupService,
    private readonly supplierDispatch: SupplierDispatch,
    private readonly userMenus: UserMenusService,
  ) {}

  async listServices(userId: string, via?: OrderVia) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { groupId: true },
    });
    const groupId = user?.groupId ?? null;
    const services = await this.prisma.service.findMany({
      where: { active: true, ...serviceViaWhere(via) },
      orderBy: { name: "asc" },
      include: {
        userPrices: { where: { userId }, select: { price: true } },
        groupPrices: { where: { groupId: groupId ?? "" }, select: { price: true } },
        serviceGroup: { select: { name: true } },
      },
    });
    return services.map(({ userPrices, groupPrices, serviceGroup, ...service }) => {
      const price = resolveUserPrice({
        defaultPrice: service.price,
        groupId,
        groupPrice: groupPrices[0]?.price,
        personalPrice: userPrices[0]?.price,
      });
      return {
        ...serializeService(service, price),
        group: serviceGroup?.name ?? null,
      };
    });
  }

  async listOrders(userId: string, q?: string, via?: OrderVia) {
    const needle = String(q ?? "").trim();
    const rows = await this.prisma.order.findMany({
      where: {
        userId,
        ...orderViaWhere(via),
        ...(needle
          ? {
              OR: [
                { orderId: { contains: needle, mode: "insensitive" } },
                { imei: { contains: needle } },
              ],
            }
          : {}),
      },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
    });
    const refreshed = [];
    for (const row of rows) {
      refreshed.push(await this.ensureNotExpired(row));
    }
    return refreshed.map((row) => serializeOrderListItem(row));
  }

  async getOrder(userId: string, publicOrderId: string) {
    const order = await this.findOwned(userId, publicOrderId);
    return serializeOrderListItem(await this.ensureNotExpired(order));
  }

  /** The user's unpaid order, after expiring it if its payment window has closed. */
  async pendingOrder(userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { userId, status: "waiting_payment" },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
    });
    if (!order) return null;
    const current = await this.ensureNotExpired(order);
    return current.status === "waiting_payment"
      ? serializeOrderListItem(current)
      : null;
  }

  /** Expires every unpaid order past its deadline; run on a timer so it does not wait for a page view. */
  async expireOverdueOrders(): Promise<number> {
    const overdue = await this.prisma.order.findMany({
      where: {
        status: "waiting_payment",
        invoice: { paymentStatus: "pending", expiredAt: { lte: new Date() } },
      },
      include: orderInclude,
      take: 50,
    });
    let expired = 0;
    for (const order of overdue) {
      const current = await this.ensureNotExpired(order);
      if (current.status === "cancel") expired++;
    }
    return expired;
  }

  /**
   * Creates one order per IMEI (up to MAX_BULK_IMEIS), all paid by a single
   * invoice for `imeis.length × price`. Returns the first order.
   *
   * `balanceOnly` (Dhru API) never issues QRIS: the balance must cover the
   * total, else InsufficientBalanceException. It also ignores the user's
   * unpaid web order, which cannot block a balance payment.
   */
  async createOrder(
    userId: string,
    input: {
      serviceId?: string;
      serviceCode?: string;
      imei?: string;
      imeis?: string[] | string;
      notes?: string;
      /** Layanan Spesial extra fields; only those the service requires are kept. */
      qnt?: number | string;
      email?: string;
      username?: string;
      channel?: OrderChannel;
      apiKeyId?: string;
      balanceOnly?: boolean;
    },
  ) {
    let serviceId = String(input.serviceId ?? "").trim();
    const serviceCode = String(input.serviceCode ?? "").trim();
    const notes = String(input.notes ?? "").trim() || null;
    const channel: OrderChannel = input.channel ?? "web";

    if (!serviceId && serviceCode) {
      const byCode = await this.prisma.service.findUnique({
        where: { code: serviceCode },
      });
      if (byCode) serviceId = byCode.id;
    }
    if (!serviceId) throw new BadRequestException("Pilih layanan.");

    const balanceOnly = input.balanceOnly === true;
    const existing = balanceOnly ? null : await this.pendingOrder(userId);
    if (existing) {
      throw new ConflictException(
        `Selesaikan atau batalkan order ${existing.orderId} yang masih menunggu pembayaran.`,
      );
    }

    const [user, service, override] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.service.findUnique({ where: { id: serviceId } }),
      this.prisma.userServicePrice.findUnique({
        where: { userId_serviceId: { userId, serviceId } },
        select: { price: true },
      }),
    ]);
    if (!service || !service.active) {
      throw new BadRequestException("Layanan tidak tersedia.");
    }
    if (channel === "web") {
      const menu = (await this.userMenus.get())[menuOfService(service)];
      if (!menu.enabled) {
        throw new BadRequestException(`Menu ${menu.label} sedang dinonaktifkan.`);
      }
    }
    let imeis: string[];
    if (service.inputType === "none") {
      imeis = [NO_DEVICE_VALUE];
    } else {
      const parsed = parseImeiList(input.imeis ?? String(input.imei ?? ""), service.inputType);
      if (!parsed.ok) throw new BadRequestException(parsed.errors.join(" "));
      imeis = parsed.imeis;
    }
    const parsedExtras = parseOrderExtras(service, input);
    if (!parsedExtras.ok) throw new BadRequestException(parsedExtras.errors.join(" "));
    const extras = parsedExtras.extras;
    const groupPrice = user.groupId
      ? await this.prisma.userGroupPrice.findUnique({
          where: { groupId_serviceId: { groupId: user.groupId, serviceId } },
          select: { price: true },
        })
      : null;

    const price = resolveUserPrice({
      defaultPrice: service.price,
      groupId: user.groupId,
      groupPrice: groupPrice?.price,
      personalPrice: override?.price,
    });
    const total = price * imeis.length;
    if (balanceOnly && user.creditBalance < total) {
      throw new InsufficientBalanceException();
    }
    const orderIds = await this.nextOrderIds(imeis.length);
    const invoiceId = `INV-${orderIds[0]}`;
    const via =
      channel === "telegram" ? "Telegram" : channel === "api" ? "API" : "website";
    const bulkNote =
      imeis.length > 1 ? ` Bulk ${imeis.length} IMEI, 1 QRIS.` : "";
    const balanceUsed = Math.min(Math.max(user.creditBalance, 0), total);
    const charge = total - balanceUsed;
    const paidByBalance = charge === 0;
    const createdNote = paidByBalance
      ? `Order dibuat lewat ${via}. Dibayar penuh dengan saldo akun (Rp${total.toLocaleString("id-ID")}).`
      : `Order dibuat lewat ${via}. Invoice QRIS diterbitkan.${bulkNote}${
          balanceUsed > 0
            ? ` Saldo akun terpakai Rp${balanceUsed.toLocaleString("id-ID")}, sisa Rp${charge.toLocaleString("id-ID")} via QRIS.`
            : ""
        }`;

    let gateway: SayabayarInvoice | null = null;
    if (paidByBalance) {
      // Nothing left for the gateway to collect.
    } else if (this.sayabayar.enabled()) {
      gateway = await this.sayabayar.createInvoice({
        amount: charge,
        description:
          imeis.length > 1
            ? `${service.name} × ${imeis.length} — ${orderIds[0]}`
            : `${service.name} — ${orderIds[0]}`,
        customerName: user.fullName,
        expiredMinutes: INVOICE_TTL_MINUTES,
        redirectUrl: `${webPublicUrl()}/app/riwayat`,
      });
    } else if (!paymentSimulationEnabled()) {
      throw new ServiceUnavailableException(
        "Pembayaran belum tersedia. Hubungi admin.",
      );
    }
    const expiredAt =
      gateway?.expiredAt ?? new Date(Date.now() + INVOICE_TTL_MS);

    const created = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.paymentInvoice.create({
        data: {
          invoiceId,
          amount: total,
          balanceUsed,
          isTest: user.role === "testing",
          paymentStatus: "pending",
          expiredAt,
          ...(gateway
            ? {
                paymentChannel: "sayabayar",
                paymentReference: gateway.id,
                amountDue: gateway.amountDue,
                qrisString: gateway.qrisString,
                checkoutUrl: gateway.paymentUrl,
                gatewayPayload: gateway.raw as Prisma.InputJsonValue,
              }
            : {
                paymentChannel: paidByBalance ? "balance" : "qris_placeholder",
              }),
        },
      });
      if (balanceUsed > 0) {
        await applyBalance(tx, {
          userId,
          amount: -balanceUsed,
          reason: "order_payment",
          refKey: `invoice-pay:${invoice.id}`,
          note: `Pembayaran invoice ${invoiceId}.`,
        }).catch((err) => {
          if (err instanceof ConflictException) {
            throw balanceOnly
              ? new InsufficientBalanceException()
              : new ConflictException("Saldo berubah. Silakan buat order lagi.");
          }
          throw err;
        });
      }
      for (const [i, imei] of imeis.entries()) {
        await tx.order.create({
          data: {
            orderId: orderIds[i],
            userId,
            serviceId: service.id,
            invoiceId: invoice.id,
            apiKeyId: input.apiKeyId ?? null,
            channel,
            imei,
            notes,
            ...extras,
            status: "waiting_payment",
            price,
            costPrice: service.costPrice,
            isTest: user.role === "testing",
            activity: {
              create: {
                status: "waiting_payment",
                note: createdNote,
                actor: user.fullName,
              },
            },
          },
        });
      }
      return tx.order.findUniqueOrThrow({
        where: { orderId: orderIds[0] },
        include: orderInclude,
      });
    });

    for (const [i, imei] of imeis.entries()) {
      this.audit.record("order.created", {
        actorUserId: userId,
        orderId: orderIds[i],
        serviceName: service.name,
        imei,
        price,
        channel,
      });
    }
    if (paidByBalance && created.invoice) {
      await this.settleInvoice(created.invoice.id, {
        paidAt: new Date(),
        channel: "balance",
        note: "Pembayaran lunas dengan saldo akun.",
      });
      return serializeOrderListItem(
        await this.prisma.order.findUniqueOrThrow({
          where: { id: created.id },
          include: orderInclude,
        }),
      );
    }
    return serializeOrderListItem(created);
  }

  async cancelOrder(userId: string, publicOrderId: string) {
    const order = await this.findOwned(userId, publicOrderId);
    const current = await this.ensureNotExpired(order);
    if (current.status !== "waiting_payment") {
      throw new BadRequestException(
        "Hanya order menunggu pembayaran yang dapat dibatalkan.",
      );
    }

    const invoice = current.invoice;
    if (!invoice) throw new BadRequestException("Invoice order tidak ditemukan.");
    const cancelled = await this.prisma.$transaction((tx) =>
      this.closePendingInvoice(tx, invoice.id, "cancelled", {
        note: "Order dibatalkan oleh user.",
        actor: current.user.fullName,
      }),
    );
    for (const order of cancelled ?? []) {
      this.audit.record("order.cancelled_by_user", {
        actorUserId: userId,
        orderId: order.orderId,
        imei: order.imei,
      });
    }
    return serializeOrderListItem(await this.findOwned(userId, publicOrderId));
  }

  /**
   * Super Admin cancel from the web panel or Telegram. Closes a pending invoice,
   * updates every admin's order card, and tells the customer. An already-paid
   * order is refunded to the customer's balance.
   */
  async adminCancelOrder(
    adminId: string,
    publicOrderId: string,
    reason?: string,
    options: { fromWeb?: boolean } = {},
  ) {
    const admin = await this.prisma.admin.findUniqueOrThrow({
      where: { id: adminId },
    });
    if (admin.role !== "super_admin" || admin.status !== "active") {
      throw new ForbiddenException("Hanya Super Admin yang dapat membatalkan order.");
    }
    const order = await this.prisma.order.findUnique({
      where: { orderId: publicOrderId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException("Order tidak ditemukan.");
    if (!CANCELLABLE_BY_ADMIN.includes(order.status)) {
      throw new BadRequestException(
        "Order yang sudah selesai, ditolak, atau dibatalkan tidak dapat dibatalkan.",
      );
    }

    const typed = String(reason ?? "").trim() || null;
    const why = typed ?? "Dibatalkan oleh Super Admin.";
    const wasPaid = order.invoice?.paymentStatus === "paid";

    if (order.invoice?.paymentStatus === "pending") {
      const cancelled = await this.prisma.$transaction(async (tx) => {
        const rows = await this.closePendingInvoice(tx, order.invoice!.id, "cancelled", {
          note: `Order dibatalkan oleh Super Admin. Alasan: ${why}`,
          actor: admin.fullName,
        });
        if (typed && rows?.length) {
          await tx.order.updateMany({
            where: { orderId: { in: rows.map((row) => row.orderId) } },
            data: { statusReason: typed },
          });
        }
        return rows;
      });
      for (const row of cancelled ?? []) {
        this.audit.record("admin.order.cancelled", {
          actorId: adminId,
          userId: order.userId,
          orderId: row.orderId,
          imei: row.imei,
          reason: why,
          wasPaid: false,
        });
      }
      if (cancelled?.length) {
        void this.adminNotify.notifyUserById(
          order.userId,
          userOrderNoticeHtml({
            kind: "cancelled",
            orderId: cancelled.map((row) => row.orderId).join(", "),
            reason: why,
            wasPaid: false,
          }),
        );
      }
      return serializeOrderListItem(
        await this.prisma.order.findUniqueOrThrow({
          where: { id: order.id },
          include: orderInclude,
        }),
      );
    }

    const { updated, refunded } = await this.prisma.$transaction(async (tx) => {
      const moved = await tx.order.updateMany({
        where: { id: order.id, status: { in: CANCELLABLE_BY_ADMIN } },
        data: { status: "cancel" },
      });
      if (moved.count !== 1) {
        throw new ConflictException("Status order berubah.");
      }
      const refunded = await refundOrderToBalance(tx, order, "order_cancelled");
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          statusReason: typed,
          activity: {
            create: {
              status: "cancel",
              note: `Order dibatalkan oleh Super Admin. Alasan: ${why}${refundNote(refunded)}`,
              actor: admin.fullName,
            },
          },
        },
        include: orderInclude,
      });
      return { updated, refunded };
    });

    this.audit.record("admin.order.cancelled", {
      actorId: adminId,
      userId: order.userId,
      orderId: order.orderId,
      imei: order.imei,
      reason: why,
      wasPaid,
    });
    this.recordRefund(order, refunded, "order_cancelled");
    void this.adminNotify.syncOrderCards(order.id, "cancelled", {
      actorName: admin.fullName,
      note: why,
    });
    if (options.fromWeb) {
      void this.adminNotify.notifySuperAdminsFollowUp(order.id, "cancelled", admin, why, {
        includeActor: true,
      });
    }
    void this.adminNotify.notifyUserById(
      order.userId,
      userOrderNoticeHtml({
        kind: "cancelled",
        orderId: order.orderId,
        reason: why,
        wasPaid,
        refund: refunded,
      }),
    );
    return serializeOrderListItem(updated);
  }

  /**
   * "Saya sudah bayar": for SayaBayar invoices this nudges the gateway to check
   * now and pulls the invoice status; it never settles on the customer's word.
   * Otherwise it simulates payment.
   */
  async markPaid(userId: string, publicOrderId: string) {
    const order = await this.findOwned(userId, publicOrderId);
    const current = await this.ensureNotExpired(order);

    if (
      current.status === "waiting_action" ||
      current.status === "paid" ||
      current.status === "in_process" ||
      current.status === "done"
    ) {
      return serializeOrderListItem(current);
    }
    if (current.status !== "waiting_payment") {
      throw new BadRequestException("Order ini tidak dapat ditandai lunas.");
    }
    if (!current.invoice || current.invoice.paymentStatus !== "pending") {
      throw new BadRequestException("Invoice tidak dalam status pending.");
    }

    const gatewayRef = this.gatewayReference(current.invoice);
    if (gatewayRef) {
      if (this.sayabayar.supportsConfirm()) {
        await this.sayabayar.confirmInvoice(gatewayRef);
      }
      await this.syncGatewayStatus(gatewayRef);
      return serializeOrderListItem(await this.findOwned(userId, publicOrderId));
    }
    if (!paymentSimulationEnabled()) {
      throw new ForbiddenException(
        "Konfirmasi pembayaran manual tidak tersedia.",
      );
    }

    await this.settleInvoice(current.invoice.id, {
      paidAt: new Date(),
      reference: `SIM-${Date.now()}`,
      note: "Pembayaran disimulasikan dan diverifikasi.",
    });
    return serializeOrderListItem(await this.findOwned(userId, publicOrderId));
  }

  /**
   * Applies a verified `invoice.paid` webhook. Matches on the gateway's invoice
   * id (stored as paymentReference) or on our own invoice number.
   */
  async confirmGatewayPayment(input: {
    gatewayInvoiceId?: string;
    invoiceNumber?: string;
    amount: number;
    channel?: string;
    paidAt: Date;
    payload: Prisma.InputJsonValue;
  }): Promise<"paid" | "duplicate" | "unmatched" | "amount_mismatch" | "late"> {
    const invoice = await this.findGatewayInvoice(input);
    if (!invoice) return "unmatched";
    if (invoice.purpose === "topup") return this.topups.applyGatewayPaid(invoice, input);
    if (invoice.paymentStatus === "paid") return "duplicate";
    if (invoice.amount - invoice.balanceUsed !== input.amount) {
      return "amount_mismatch";
    }

    if (invoice.paymentStatus !== "pending") {
      const userId = invoice.orders[0]?.userId;
      if (!userId) return "late";
      const credited = await this.prisma.$transaction(async (tx) => {
        const credited = await applyBalance(tx, {
          userId,
          amount: input.amount,
          reason: "late_payment",
          refKey: `invoice-late:${invoice.id}`,
          note: `Pembayaran terlambat invoice ${invoice.invoiceId}.`,
        });
        if (!credited) return false;
        await tx.orderActivityLog.createMany({
          data: invoice.orders.map((order) => ({
            orderId: order.id,
            status: order.status,
            note: `Pembayaran Rp${input.amount.toLocaleString("id-ID")} diterima gateway setelah invoice ${invoice.paymentStatus}. Dana dimasukkan ke saldo akun.`,
            actor: "Sistem",
          })),
        });
        return true;
      });
      if (!credited) return "duplicate";
      const orderIds = invoice.orders.map((order) => order.orderId).join(", ");
      this.audit.record("payment.late", {
        userId,
        orderId: orderIds,
        amount: input.amount,
        invoiceStatus: invoice.paymentStatus,
      });
      this.audit.record("balance.refunded", {
        userId,
        orderId: orderIds,
        amount: input.amount,
        reason: "late_payment",
      });
      void this.adminNotify.notifyUserById(
        userId,
        userOrderNoticeHtml({
          kind: "late_payment",
          orderId: orderIds,
          refund: input.amount,
        }),
      );
      return "late";
    }

    const settled = await this.settleInvoice(invoice.id, {
      paidAt: input.paidAt,
      reference: input.gatewayInvoiceId,
      channel: input.channel,
      payload: input.payload,
      note: `Pembayaran diterima via SayaBayar${input.channel ? ` (${input.channel})` : ""}.`,
    });
    return settled ? "paid" : "duplicate";
  }

  /** Applies a verified `invoice.expired` / `invoice.cancelled` webhook. */
  async closeGatewayInvoice(
    input: { gatewayInvoiceId?: string; invoiceNumber?: string },
    status: "expired" | "cancelled",
  ): Promise<"closed" | "ignored" | "unmatched"> {
    const invoice = await this.findGatewayInvoice(input);
    if (!invoice) return "unmatched";
    if (invoice.purpose === "topup") return this.topups.closeFromGateway(invoice.id, status);

    const closed = await this.prisma.$transaction((tx) =>
      this.closePendingInvoice(tx, invoice.id, status, {
        note:
          status === "expired"
            ? "Invoice kedaluwarsa di payment gateway, order dibatalkan otomatis."
            : "Invoice dibatalkan di payment gateway, order dibatalkan.",
        actor: "Sistem",
      }),
    );
    if (closed === null) return "ignored";
    if (status === "expired") this.reportExpired(closed, "gateway");
    return "closed";
  }

  async acceptOrder(adminId: string, publicOrderId: string) {
    const admin = await this.prisma.admin.findUniqueOrThrow({
      where: { id: adminId },
    });
    if (admin.status !== "active") {
      throw new ForbiddenException("Akun admin tidak aktif.");
    }

    const claimed = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { orderId: publicOrderId },
      });
      if (!order) throw new NotFoundException("Order tidak ditemukan.");
      await this.assertAssignedToService(tx, admin, order.serviceId);

      const result = await tx.order.updateMany({
        where: { id: order.id, status: "waiting_action" },
        data: {
          status: "in_process",
          assignedAdminId: adminId,
          startedAt: new Date(),
        },
      });
      if (result.count !== 1) {
        throw new ConflictException("Order sudah diambil admin lain.");
      }
      await tx.orderActivityLog.create({
        data: {
          orderId: order.id,
          status: "in_process",
          note: `Order diambil oleh ${admin.fullName}.`,
          actor: admin.fullName,
        },
      });
      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: orderInclude,
      });
    });

    this.audit.record("order.taken", {
      actorId: adminId,
      userId: claimed.userId,
      orderId: claimed.orderId,
      serviceName: claimed.service.name,
      imei: claimed.imei,
    });
    await this.adminNotify.syncOrderCards(claimed.id, "taken", {
      actorName: admin.fullName,
    });
    void this.adminNotify.notifySuperAdminsFollowUp(claimed.id, "taken", admin);
    void this.adminNotify.notifyUserById(
      claimed.userId,
      userOrderNoticeHtml({ kind: "taken", orderId: claimed.orderId }),
    );
    return serializeOrderListItem(claimed);
  }

  async rejectOrder(adminId: string, publicOrderId: string, reason?: string) {
    const note = String(reason ?? "").trim() || undefined;
    const admin = await this.prisma.admin.findUniqueOrThrow({
      where: { id: adminId },
    });

    const { updated, refunded } = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { orderId: publicOrderId },
      });
      if (!order) throw new NotFoundException("Order tidak ditemukan.");

      if (order.status === "waiting_action") {
        await this.assertAssignedToService(tx, admin, order.serviceId);
        const result = await tx.order.updateMany({
          where: { id: order.id, status: "waiting_action" },
          data: {
            status: "rejected",
            assignedAdminId: adminId,
            statusReason: note ?? null,
          },
        });
        if (result.count !== 1) {
          throw new ConflictException("Status order berubah.");
        }
      } else if (order.status === "in_process") {
        if (order.assignedAdminId !== adminId) {
          throw new ForbiddenException(
            "Hanya admin yang mengambil order yang dapat menolak.",
          );
        }
        const result = await tx.order.updateMany({
          where: { id: order.id, status: "in_process" },
          data: { status: "rejected", statusReason: note ?? null },
        });
        if (result.count !== 1) {
          throw new ConflictException("Status order berubah.");
        }
      } else {
        throw new BadRequestException("Order tidak dapat ditolak.");
      }

      const refunded = await refundOrderToBalance(tx, order, "order_rejected");
      await tx.orderActivityLog.create({
        data: {
          orderId: order.id,
          status: "rejected",
          note: `${note ? `Ditolak: ${note}` : "Ditolak"}${refundNote(refunded)}`,
          actor: admin.fullName,
        },
      });
      const updated = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: orderInclude,
      });
      return { updated, refunded };
    });

    this.audit.record("order.rejected", {
      actorId: adminId,
      userId: updated.userId,
      orderId: updated.orderId,
      serviceName: updated.service.name,
      imei: updated.imei,
      reason: note,
    });
    this.recordRefund(updated, refunded, "order_rejected");
    await this.adminNotify.syncOrderCards(updated.id, "rejected", {
      actorName: admin.fullName,
      note,
    });
    void this.adminNotify.notifySuperAdminsFollowUp(updated.id, "rejected", admin, note);
    void this.adminNotify.notifyUserById(
      updated.userId,
      userOrderNoticeHtml({
        kind: "rejected",
        orderId: updated.orderId,
        imei: updated.imei,
        serviceName: updated.service.name,
        reason: note,
        refund: refunded,
        duration: processDurationLabel(updated),
      }),
    );
    return serializeOrderListItem(updated);
  }

  async completeOrder(
    adminId: string,
    publicOrderId: string,
    input: { resultStatus: ResultStatus; resultNote: string },
  ) {
    const typedNote = String(input.resultNote ?? "").trim();
    const resultNote = typedNote || "Order selesai diproses.";
    if (!["success", "failed"].includes(input.resultStatus)) {
      throw new BadRequestException("Status hasil tidak valid.");
    }
    const admin = await this.prisma.admin.findUniqueOrThrow({
      where: { id: adminId },
    });

    const { updated, refunded } = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { orderId: publicOrderId },
      });
      if (!order) throw new NotFoundException("Order tidak ditemukan.");
      if (order.status !== "in_process" || order.assignedAdminId !== adminId) {
        throw new ForbiddenException(
          "Hanya admin pemegang order yang dapat menandai Done.",
        );
      }

      await tx.orderResult.create({
        data: {
          orderId: order.id,
          resultStatus: input.resultStatus,
          resultNote,
          createdByAdminId: adminId,
        },
      });
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "done",
          completedAt: new Date(),
        },
      });
      const refunded =
        input.resultStatus === "failed"
          ? await refundOrderToBalance(tx, order, "order_failed")
          : 0;
      await tx.orderActivityLog.create({
        data: {
          orderId: order.id,
          status: "done",
          note: `Hasil dikirim (${input.resultStatus}).${refundNote(refunded)}`,
          actor: admin.fullName,
        },
      });
      const updated = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: orderInclude,
      });
      return { updated, refunded };
    });

    this.audit.record("order.done", {
      actorId: adminId,
      userId: updated.userId,
      orderId: updated.orderId,
      serviceName: updated.service.name,
      imei: updated.imei,
    });
    this.recordRefund(updated, refunded, "order_failed");
    await this.adminNotify.syncOrderCards(updated.id, "done", {
      actorName: admin.fullName,
      note: resultNote,
    });
    void this.adminNotify.notifySuperAdminsFollowUp(
      updated.id,
      "done",
      admin,
      resultNote,
    );
    void this.adminNotify.notifyUserById(
      updated.userId,
      userOrderNoticeHtml({
        kind: "done",
        orderId: updated.orderId,
        imei: updated.imei,
        serviceName: updated.service.name,
        resultStatus: input.resultStatus,
        note: typedNote,
        refund: refunded,
        duration: processDurationLabel(updated),
      }),
    );
    return serializeOrderListItem(updated);
  }

  /**
   * Applies a status update reported by the external processor (Roamercheck)
   * to a WhatsApp-fulfilled order. Only moves forward: waiting_action →
   * in_process → done/rejected. Returns "noop" when the order is already past
   * the requested state.
   */
  async applyProcessorUpdate(
    internalOrderId: string,
    update:
      | { kind: "processing"; note?: string }
      | { kind: "done"; note?: string }
      | { kind: "rejected"; reason: string },
    actor: { username: string; fullName: string },
  ): Promise<"applied" | "noop"> {
    const actorLabel = `${actor.username} (${actor.fullName})`;
    const fromStatuses: OrderStatus[] =
      update.kind === "processing"
        ? ["waiting_action"]
        : ["waiting_action", "in_process"];
    const next: OrderStatus =
      update.kind === "processing"
        ? "in_process"
        : update.kind === "done"
          ? "done"
          : "rejected";
    const note =
      update.kind === "processing"
        ? update.note ?? `Diproses oleh ${actorLabel}.`
        : update.kind === "done"
          ? update.note?.trim() || "IMEI berhasil diproses."
          : update.reason;

    const updated = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const result = await tx.order.updateMany({
        where: { id: internalOrderId, status: { in: fromStatuses } },
        data: {
          status: next,
          ...(update.kind === "processing" ? { startedAt: now } : {}),
          ...(update.kind === "done" ? { completedAt: now } : {}),
          ...(update.kind === "rejected" ? { statusReason: update.reason } : {}),
        },
      });
      if (result.count !== 1) return null;
      if (update.kind === "done") {
        await tx.orderResult.create({
          data: {
            orderId: internalOrderId,
            resultStatus: "success",
            resultNote: note,
            createdByAdminId: null,
          },
        });
      }
      const order = await tx.order.findUniqueOrThrow({
        where: { id: internalOrderId },
      });
      const refunded =
        update.kind === "rejected"
          ? await refundOrderToBalance(tx, order, "order_rejected")
          : 0;
      await tx.orderActivityLog.create({
        data: {
          orderId: internalOrderId,
          status: next,
          note:
            update.kind === "rejected"
              ? `Ditolak: ${note}${refundNote(refunded)}`
              : update.kind === "done"
                ? "Hasil dikirim (success)."
                : note,
          actor: actorLabel,
        },
      });
      const updated = await tx.order.findUniqueOrThrow({
        where: { id: internalOrderId },
        include: orderInclude,
      });
      return { ...updated, refunded };
    });
    if (!updated) return "noop";

    const cardKind =
      update.kind === "processing"
        ? "taken"
        : update.kind === "done"
          ? "done"
          : "rejected";
    void this.adminNotify.syncOrderCards(internalOrderId, cardKind, {
      actorName: actorLabel,
      note,
    });
    const base = {
      userId: updated.userId,
      orderId: updated.orderId,
      serviceName: updated.service.name,
      imei: updated.imei,
      by: actor.username,
    };
    if (update.kind === "processing") {
      this.audit.record("order.taken", base);
      void this.adminNotify.notifyUserById(
        updated.userId,
        userOrderNoticeHtml({ kind: "taken", orderId: updated.orderId }),
      );
    } else if (update.kind === "done") {
      this.audit.record("order.done", base);
      void this.adminNotify.notifyUserById(
        updated.userId,
        userOrderNoticeHtml({
          kind: "done",
          orderId: updated.orderId,
          imei: updated.imei,
          serviceName: updated.service.name,
          resultStatus: "success",
          note: update.note?.trim() ?? "",
          duration: processDurationLabel(updated),
        }),
      );
    } else {
      this.audit.record("order.rejected", { ...base, reason: note });
      this.recordRefund(updated, updated.refunded, "order_rejected");
      void this.adminNotify.notifyUserById(
        updated.userId,
        userOrderNoticeHtml({
          kind: "rejected",
          orderId: updated.orderId,
          imei: updated.imei,
          serviceName: updated.service.name,
          reason: note,
          refund: updated.refunded,
          duration: processDurationLabel(updated),
        }),
      );
    }
    return "applied";
  }

  async listRecentForUser(userId: string, take = 5) {
    const rows = await this.prisma.order.findMany({
      where: { userId },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take,
    });
    return rows.map((row) => serializeOrderListItem(row));
  }

  async listAdminQueue(adminId: string, take = 5) {
    const admin = await this.prisma.admin.findUniqueOrThrow({
      where: { id: adminId },
      select: { role: true },
    });
    const rows = await this.prisma.order.findMany({
      where: {
        OR: [
          {
            status: "waiting_action",
            ...(admin.role === "super_admin"
              ? {}
              : assignedServiceFilter(adminId)),
          },
          { status: "in_process", assignedAdminId: adminId },
        ],
      },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take,
    });
    return rows.map((row) => serializeOrderListItem(row));
  }

  private recordRefund(
    order: { userId: string; orderId: string },
    amount: number,
    reason: BalanceReason,
  ) {
    if (amount <= 0) return;
    this.audit.record("balance.refunded", {
      userId: order.userId,
      orderId: order.orderId,
      amount,
      reason,
    });
  }

  private async assertAssignedToService(
    tx: Prisma.TransactionClient,
    admin: { id: string; role: AdminRole },
    serviceId: string,
  ) {
    if (admin.role === "super_admin") return;
    const assignment = await tx.serviceAssignment.findUnique({
      where: { serviceId_adminId: { serviceId, adminId: admin.id } },
      select: { service: { select: { fulfillmentChannel: true } } },
    });
    if (!assignment) {
      throw new ForbiddenException("Layanan ini tidak di-assign ke Anda.");
    }
    if (assignment.service.fulfillmentChannel === "whatsapp") {
      throw new ForbiddenException("Layanan ini diproses lewat grup WhatsApp.");
    }
  }

  private gatewayReference(invoice: {
    paymentChannel: string;
    paymentReference: string | null;
  }): string | null {
    return invoice.paymentChannel === "sayabayar" && invoice.paymentReference
      ? invoice.paymentReference
      : null;
  }

  /**
   * Pulls the invoice status from SayaBayar and applies it — the fallback for a
   * missed or delayed webhook. Gateway errors leave the order untouched.
   */
  private async syncGatewayStatus(gatewayInvoiceId: string) {
    let remote;
    try {
      remote = await this.sayabayar.getInvoice(gatewayInvoiceId);
    } catch {
      return;
    }
    if (remote.status === "paid" && remote.amount != null) {
      await this.confirmGatewayPayment({
        gatewayInvoiceId,
        amount: remote.amount,
        channel: remote.channel ?? undefined,
        paidAt: remote.paidAt ?? new Date(),
        payload: remote.raw as Prisma.InputJsonValue,
      });
    } else if (remote.status === "expired") {
      await this.closeGatewayInvoice({ gatewayInvoiceId }, "expired");
    }
  }

  /**
   * Marks a pending invoice paid and queues every order it pays for; null if
   * it was no longer pending.
   */
  private async settleInvoice(
    invoiceRowId: string,
    payment: {
      paidAt: Date;
      note: string;
      reference?: string;
      channel?: string;
      payload?: Prisma.InputJsonValue;
    },
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.paymentInvoice.updateMany({
        where: { id: invoiceRowId, paymentStatus: "pending" },
        data: {
          paymentStatus: "paid",
          paidAt: payment.paidAt,
          ...(payment.reference ? { paymentReference: payment.reference } : {}),
          ...(payment.channel ? { paymentChannel: payment.channel } : {}),
          ...(payment.payload !== undefined
            ? { gatewayPayload: payment.payload }
            : {}),
        },
      });
      if (claimed.count !== 1) return null;
      const orders = await tx.order.findMany({
        where: { invoiceId: invoiceRowId, status: "waiting_payment" },
        select: {
          id: true,
          orderId: true,
          userId: true,
          price: true,
          service: { select: { fulfillmentChannel: true } },
        },
        orderBy: { orderId: "asc" },
      });
      for (const order of orders) {
        await tx.orderActivityLog.create({
          data: {
            orderId: order.id,
            status: "paid",
            note: payment.note,
            actor: "Sistem",
          },
        });
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "waiting_action",
            activity: {
              create: {
                status: "waiting_action",
                note:
                  order.service.fulfillmentChannel === "supplier"
                    ? "Order diteruskan otomatis ke Supplier API."
                    : "Order masuk antrean dan siap diambil admin.",
                actor: "Sistem",
              },
            },
          },
        });
      }
      const whatsappId = orders.length
        ? await this.whatsappNotify.enqueuePaidInvoice(tx, invoiceRowId)
        : null;
      return { orders, whatsappId };
    });

    if (!result) return null;
    for (const order of result.orders) {
      this.audit.record("payment.paid", {
        userId: order.userId,
        orderId: order.orderId,
        amount: order.price,
        method: payment.channel,
      });
      void this.adminNotify.notifyNewOrder(order.id);
    }
    if (result.orders.some((order) => order.service.fulfillmentChannel === "supplier")) {
      this.supplierDispatch.notifyPaid();
    }
    if (result.whatsappId) void this.whatsappNotify.deliver(result.whatsappId);
    return result.orders;
  }

  /**
   * Closes a pending invoice, cancels every unpaid order on it, and returns any
   * balance used at checkout. Returns the cancelled orders, or null if the
   * invoice was no longer pending.
   */
  private async closePendingInvoice(
    tx: Prisma.TransactionClient,
    invoiceRowId: string,
    status: "expired" | "cancelled",
    log: { note: string; actor: string },
  ) {
    const claimed = await tx.paymentInvoice.updateMany({
      where: { id: invoiceRowId, paymentStatus: "pending" },
      data: { paymentStatus: status },
    });
    if (claimed.count !== 1) return null;
    const invoice = await tx.paymentInvoice.findUniqueOrThrow({
      where: { id: invoiceRowId },
      select: { invoiceId: true, balanceUsed: true },
    });
    const orders = await tx.order.findMany({
      where: { invoiceId: invoiceRowId, status: "waiting_payment" },
      select: { id: true, orderId: true, imei: true, userId: true },
      orderBy: { orderId: "asc" },
    });
    const released =
      invoice.balanceUsed > 0 && orders.length > 0 &&
      (await applyBalance(tx, {
        userId: orders[0].userId,
        amount: invoice.balanceUsed,
        reason: "payment_release",
        refKey: `invoice-release:${invoiceRowId}`,
        note: `Saldo dari invoice ${invoice.invoiceId} dikembalikan.`,
      }));
    const note = log.note + (released ? refundNote(invoice.balanceUsed) : "");
    for (const order of orders) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "cancel",
          activity: { create: { status: "cancel", actor: log.actor, note } },
        },
      });
    }
    return orders;
  }

  private async findGatewayInvoice(ref: {
    gatewayInvoiceId?: string;
    invoiceNumber?: string;
  }) {
    const match: Prisma.PaymentInvoiceWhereInput[] = [];
    if (ref.gatewayInvoiceId) {
      match.push({ paymentReference: ref.gatewayInvoiceId });
    }
    if (ref.invoiceNumber) match.push({ invoiceId: ref.invoiceNumber });
    if (!match.length) return null;
    return this.prisma.paymentInvoice.findFirst({
      where: { OR: match },
      include: {
        orders: {
          select: { id: true, orderId: true, userId: true, status: true },
        },
      },
    });
  }

  private async findOwned(userId: string, publicOrderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { orderId: publicOrderId, userId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException("Order tidak ditemukan.");
    return order;
  }

  private async ensureNotExpired<
    T extends Prisma.OrderGetPayload<{ include: typeof orderInclude }>,
  >(order: T): Promise<T> {
    if (
      order.status !== "waiting_payment" ||
      !order.invoice ||
      order.invoice.paymentStatus !== "pending"
    ) {
      return order;
    }
    if (order.invoice.expiredAt.getTime() > Date.now()) {
      return order;
    }

    const gatewayRef = this.gatewayReference(order.invoice);
    if (gatewayRef) {
      await this.syncGatewayStatus(gatewayRef);
      const synced = await this.prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: orderInclude,
      });
      if (synced.invoice?.paymentStatus !== "pending") return synced as T;
    }

    const invoiceRowId = order.invoice.id;
    const expired = await this.prisma.$transaction((tx) =>
      this.closePendingInvoice(tx, invoiceRowId, "expired", {
        note: "Batas waktu pembayaran terlewat, order dibatalkan otomatis.",
        actor: "Sistem",
      }),
    );
    if (expired) this.reportExpired(expired, "timeout");
    return (await this.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: orderInclude,
    })) as T;
  }

  /** One notice per customer listing every order that expired together. */
  private reportExpired(
    orders: Array<{ orderId: string; userId: string }>,
    source: "timeout" | "gateway",
  ) {
    if (!orders.length) return;
    for (const order of orders) {
      this.audit.record("order.expired", {
        userId: order.userId,
        orderId: order.orderId,
        source,
      });
    }
    void this.adminNotify.notifyUserById(
      orders[0].userId,
      userOrderNoticeHtml({
        kind: "expired",
        orderId: orders.map((order) => order.orderId).join(", "),
      }),
    );
  }

  /** `count` consecutive free Order IDs for today (Asia/Jakarta). */
  private async nextOrderIds(count: number): Promise<string[]> {
    const first = await this.nextOrderId();
    const prefix = first.slice(0, -4);
    const start = Number(first.slice(-4));
    const ids: string[] = [];
    for (let seq = start; ids.length < count; seq++) {
      const candidate = `${prefix}${String(seq).padStart(4, "0")}`;
      const clash = await this.prisma.order.findUnique({
        where: { orderId: candidate },
        select: { id: true },
      });
      if (!clash) ids.push(candidate);
    }
    return ids;
  }

  private async nextOrderId(): Promise<string> {
    const now = new Date();
    const jakarta = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }),
    );
    const yy = String(jakarta.getFullYear()).slice(-2);
    const mm = String(jakarta.getMonth() + 1).padStart(2, "0");
    const dd = String(jakarta.getDate()).padStart(2, "0");
    const prefix = `ZT${yy}${mm}${dd}`;

    const count = await this.prisma.order.count({
      where: { orderId: { startsWith: prefix } },
    });
    const seq = String(count + 1).padStart(4, "0");
    const candidate = `${prefix}${seq}`;
    const clash = await this.prisma.order.findUnique({
      where: { orderId: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
    return `${prefix}${String(count + 2).padStart(4, "0")}`;
  }
}
