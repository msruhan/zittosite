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
import { userOrderNoticeHtml } from "../telegram/telegram-messages";
import { PrismaService } from "../prisma/prisma.service";
import { paymentSimulationEnabled, webPublicUrl } from "../config/env";
import { AdminNotifyService } from "../telegram/admin-notify.service";
import { AuditLogService } from "../security/audit-log.service";
import {
  SayabayarClient,
  type SayabayarInvoice,
} from "../payments/sayabayar.client";
import { serializeOrderListItem, serializeService } from "./orders.serializer";

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
  invoice: true,
  result: true,
  activity: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.OrderInclude;

/** Orders whose service is assigned to this operator. */
export function assignedServiceFilter(adminId: string) {
  return {
    service: { assignments: { some: { adminId } } },
  } satisfies Prisma.OrderWhereInput;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminNotify: AdminNotifyService,
    private readonly sayabayar: SayabayarClient,
    private readonly audit: AuditLogService,
  ) {}

  async listServices(userId: string) {
    const services = await this.prisma.service.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { userPrices: { where: { userId }, select: { price: true } } },
    });
    return services.map(({ userPrices, ...service }) =>
      serializeService(service, userPrices[0]?.price ?? service.price),
    );
  }

  async listOrders(userId: string, q?: string) {
    const needle = String(q ?? "").trim();
    const rows = await this.prisma.order.findMany({
      where: {
        userId,
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

  async createOrder(
    userId: string,
    input: {
      serviceId?: string;
      serviceCode?: string;
      imei?: string;
      notes?: string;
      channel?: OrderChannel;
    },
  ) {
    let serviceId = String(input.serviceId ?? "").trim();
    const serviceCode = String(input.serviceCode ?? "").trim();
    const imei = String(input.imei ?? "").trim();
    const notes = String(input.notes ?? "").trim() || null;
    const channel: OrderChannel = input.channel ?? "web";

    if (!serviceId && serviceCode) {
      const byCode = await this.prisma.service.findUnique({
        where: { code: serviceCode },
      });
      if (byCode) serviceId = byCode.id;
    }
    if (!serviceId) throw new BadRequestException("Pilih layanan.");
    if (!/^\d{15}$/.test(imei)) {
      throw new BadRequestException("IMEI harus 15 digit angka.");
    }

    const existing = await this.pendingOrder(userId);
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

    const price = override?.price ?? service.price;
    const orderId = await this.nextOrderId();
    const invoiceId = `INV-${orderId}`;
    const via = channel === "telegram" ? "Telegram" : "website";

    let gateway: SayabayarInvoice | null = null;
    if (this.sayabayar.enabled()) {
      gateway = await this.sayabayar.createInvoice({
        amount: price,
        description: `${service.name} — ${orderId}`,
        customerName: user.fullName,
        expiredMinutes: INVOICE_TTL_MINUTES,
        redirectUrl: `${webPublicUrl()}/app/order/${orderId}/status`,
      });
    } else if (!paymentSimulationEnabled()) {
      throw new ServiceUnavailableException(
        "Pembayaran belum tersedia. Hubungi admin.",
      );
    }
    const expiredAt =
      gateway?.expiredAt ?? new Date(Date.now() + INVOICE_TTL_MS);

    const created = await this.prisma.order.create({
      data: {
        orderId,
        userId,
        serviceId: service.id,
        channel,
        imei,
        notes,
        status: "waiting_payment",
        price,
        invoice: {
          create: {
            invoiceId,
            amount: price,
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
              : { paymentChannel: "qris_placeholder" }),
          },
        },
        activity: {
          create: {
            status: "waiting_payment",
            note: `Order dibuat lewat ${via}. Invoice QRIS diterbitkan.`,
            actor: user.fullName,
          },
        },
      },
      include: orderInclude,
    });

    this.audit.record("order.created", {
      actorUserId: userId,
      orderId,
      serviceName: service.name,
      imei,
      price,
      channel,
    });
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

    const updated = await this.prisma.$transaction(async (tx) => {
      if (current.invoice) {
        await tx.paymentInvoice.update({
          where: { id: current.invoice.id },
          data: { paymentStatus: "cancelled" },
        });
      }
      return tx.order.update({
        where: { id: current.id },
        data: {
          status: "cancel",
          activity: {
            create: {
              status: "cancel",
              note: "Order dibatalkan oleh user.",
              actor: current.user.fullName,
            },
          },
        },
        include: orderInclude,
      });
    });
    this.audit.record("order.cancelled_by_user", {
      actorUserId: userId,
      orderId: current.orderId,
      imei: current.imei,
    });
    return serializeOrderListItem(updated);
  }

  /**
   * Super Admin cancel from the web panel or Telegram. Closes a pending invoice,
   * updates every admin's order card, and tells the customer. An already-paid
   * order is cancelled too but flagged for a manual refund.
   */
  async adminCancelOrder(adminId: string, publicOrderId: string, reason?: string) {
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

    const why = String(reason ?? "").trim() || "Dibatalkan oleh Super Admin.";
    const wasPaid = order.invoice?.paymentStatus === "paid";
    const updated = await this.prisma.$transaction(async (tx) => {
      if (order.invoice?.paymentStatus === "pending") {
        await tx.paymentInvoice.update({
          where: { id: order.invoice.id },
          data: { paymentStatus: "cancelled" },
        });
      }
      return tx.order.update({
        where: { id: order.id },
        data: {
          status: "cancel",
          activity: {
            create: {
              status: "cancel",
              note: `Order dibatalkan oleh Super Admin. Alasan: ${why}${
                wasPaid ? " Pembayaran sudah diterima — perlu refund manual." : ""
              }`,
              actor: admin.fullName,
            },
          },
        },
        include: orderInclude,
      });
    });

    this.audit.record("admin.order.cancelled", {
      actorId: adminId,
      userId: order.userId,
      orderId: order.orderId,
      imei: order.imei,
      reason: why,
      wasPaid,
    });
    void this.adminNotify.syncOrderCards(order.id, "cancelled", {
      actorName: admin.fullName,
      note: why,
    });
    void this.adminNotify.notifyUserById(
      order.userId,
      userOrderNoticeHtml({
        kind: "cancelled",
        orderId: order.orderId,
        reason: why,
        wasPaid,
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

    const updated = await this.settleInvoice(current.id, current.invoice.id, {
      paidAt: new Date(),
      reference: `SIM-${Date.now()}`,
      note: "Pembayaran disimulasikan dan diverifikasi.",
    });
    if (!updated) {
      return serializeOrderListItem(await this.findOwned(userId, publicOrderId));
    }
    return serializeOrderListItem(updated);
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
    if (invoice.paymentStatus === "paid") return "duplicate";
    if (invoice.amount !== input.amount) return "amount_mismatch";

    if (invoice.paymentStatus !== "pending") {
      await this.prisma.orderActivityLog.create({
        data: {
          orderId: invoice.orderId,
          status: invoice.order.status,
          note: `Pembayaran Rp ${input.amount} diterima gateway setelah invoice ${invoice.paymentStatus}. Perlu tindak lanjut manual (proses atau refund).`,
          actor: "Sistem",
        },
      });
      const lateOrder = await this.prisma.order.findUnique({
        where: { id: invoice.orderId },
        select: { orderId: true, userId: true },
      });
      this.audit.record("payment.late", {
        userId: lateOrder?.userId,
        orderId: lateOrder?.orderId,
        amount: input.amount,
        invoiceStatus: invoice.paymentStatus,
      });
      return "late";
    }

    const updated = await this.settleInvoice(invoice.orderId, invoice.id, {
      paidAt: input.paidAt,
      reference: input.gatewayInvoiceId,
      channel: input.channel,
      payload: input.payload,
      note: `Pembayaran diterima via SayaBayar${input.channel ? ` (${input.channel})` : ""}.`,
    });
    return updated ? "paid" : "duplicate";
  }

  /** Applies a verified `invoice.expired` / `invoice.cancelled` webhook. */
  async closeGatewayInvoice(
    input: { gatewayInvoiceId?: string; invoiceNumber?: string },
    status: "expired" | "cancelled",
  ): Promise<"closed" | "ignored" | "unmatched"> {
    const invoice = await this.findGatewayInvoice(input);
    if (!invoice) return "unmatched";

    const result = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.paymentInvoice.updateMany({
        where: { id: invoice.id, paymentStatus: "pending" },
        data: { paymentStatus: status },
      });
      if (claimed.count !== 1) return "ignored" as const;
      await tx.order.update({
        where: { id: invoice.orderId },
        data: {
          status: "cancel",
          activity: {
            create: {
              status: "cancel",
              note:
                status === "expired"
                  ? "Invoice kedaluwarsa di payment gateway, order dibatalkan otomatis."
                  : "Invoice dibatalkan di payment gateway, order dibatalkan.",
              actor: "Sistem",
            },
          },
        },
      });
      return "closed" as const;
    });
    if (result === "closed" && status === "expired") {
      const order = await this.prisma.order.findUnique({
        where: { id: invoice.orderId },
        select: { userId: true, orderId: true },
      });
      if (order) {
        this.notifyExpired(order.userId, order.orderId);
        this.audit.record("order.expired", {
          userId: order.userId,
          orderId: order.orderId,
          source: "gateway",
        });
      }
    }
    return result;
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

  async rejectOrder(adminId: string, publicOrderId: string, reason: string) {
    const note = String(reason ?? "").trim() || "Ditolak tanpa alasan.";
    const admin = await this.prisma.admin.findUniqueOrThrow({
      where: { id: adminId },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { orderId: publicOrderId },
      });
      if (!order) throw new NotFoundException("Order tidak ditemukan.");

      if (order.status === "waiting_action") {
        await this.assertAssignedToService(tx, admin, order.serviceId);
        const result = await tx.order.updateMany({
          where: { id: order.id, status: "waiting_action" },
          data: { status: "rejected", assignedAdminId: adminId },
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
        await tx.order.update({
          where: { id: order.id },
          data: { status: "rejected" },
        });
      } else {
        throw new BadRequestException("Order tidak dapat ditolak.");
      }

      await tx.orderActivityLog.create({
        data: {
          orderId: order.id,
          status: "rejected",
          note: `Ditolak: ${note}`,
          actor: admin.fullName,
        },
      });
      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: orderInclude,
      });
    });

    this.audit.record("order.rejected", {
      actorId: adminId,
      userId: updated.userId,
      orderId: updated.orderId,
      serviceName: updated.service.name,
      imei: updated.imei,
      reason: note,
    });
    await this.adminNotify.syncOrderCards(updated.id, "rejected", {
      actorName: admin.fullName,
      note,
    });
    void this.adminNotify.notifySuperAdminsFollowUp(
      updated.id,
      "rejected",
      admin,
      note,
    );
    void this.adminNotify.notifyUserById(
      updated.userId,
      userOrderNoticeHtml({
        kind: "rejected",
        orderId: updated.orderId,
        reason: note,
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
    if (!["success", "partial", "failed"].includes(input.resultStatus)) {
      throw new BadRequestException("Status hasil tidak valid.");
    }
    const admin = await this.prisma.admin.findUniqueOrThrow({
      where: { id: adminId },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
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
      await tx.orderActivityLog.create({
        data: {
          orderId: order.id,
          status: "done",
          note: `Hasil dikirim (${input.resultStatus}).`,
          actor: admin.fullName,
        },
      });
      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: orderInclude,
      });
    });

    this.audit.record("order.done", {
      actorId: adminId,
      userId: updated.userId,
      orderId: updated.orderId,
      serviceName: updated.service.name,
      imei: updated.imei,
    });
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
        resultStatus: input.resultStatus,
        note: typedNote,
      }),
    );
    return serializeOrderListItem(updated);
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

  private async assertAssignedToService(
    tx: Prisma.TransactionClient,
    admin: { id: string; role: AdminRole },
    serviceId: string,
  ) {
    if (admin.role === "super_admin") return;
    const assignment = await tx.serviceAssignment.findUnique({
      where: { serviceId_adminId: { serviceId, adminId: admin.id } },
      select: { adminId: true },
    });
    if (!assignment) {
      throw new ForbiddenException("Layanan ini tidak di-assign ke Anda.");
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

  /** Marks a pending invoice paid and queues the order; null if it was no longer pending. */
  private async settleInvoice(
    orderRowId: string,
    invoiceRowId: string,
    payment: {
      paidAt: Date;
      note: string;
      reference?: string;
      channel?: string;
      payload?: Prisma.InputJsonValue;
    },
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
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
      await tx.orderActivityLog.create({
        data: {
          orderId: orderRowId,
          status: "paid",
          note: payment.note,
          actor: "Sistem",
        },
      });
      return tx.order.update({
        where: { id: orderRowId },
        data: {
          status: "waiting_action",
          activity: {
            create: {
              status: "waiting_action",
              note: "Order masuk antrean dan siap diambil admin.",
              actor: "Sistem",
            },
          },
        },
        include: orderInclude,
      });
    });

    if (updated) {
      this.audit.record("payment.paid", {
        userId: updated.userId,
        orderId: updated.orderId,
        amount: updated.invoice?.amount ?? updated.price,
        method: payment.channel ?? updated.invoice?.paymentChannel ?? undefined,
      });
      void this.adminNotify.notifyNewOrder(updated.id);
    }
    return updated;
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
      include: { order: { select: { status: true } } },
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

    let expiredNow = false;
    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.paymentInvoice.updateMany({
        where: {
          id: order.invoice!.id,
          paymentStatus: "pending",
        },
        data: { paymentStatus: "expired" },
      });
      if (claimed.count !== 1) {
        return tx.order.findUniqueOrThrow({
          where: { id: order.id },
          include: orderInclude,
        });
      }
      expiredNow = true;
      return tx.order.update({
        where: { id: order.id },
        data: {
          status: "cancel",
          activity: {
            create: {
              status: "cancel",
              note: "Batas waktu pembayaran terlewat, order dibatalkan otomatis.",
              actor: "Sistem",
            },
          },
        },
        include: orderInclude,
      });
    });
    if (expiredNow) {
      this.notifyExpired(updated.userId, updated.orderId);
      this.audit.record("order.expired", {
        userId: updated.userId,
        orderId: updated.orderId,
        source: "timeout",
      });
    }
    return updated as T;
  }

  private notifyExpired(userId: string, publicOrderId: string) {
    void this.adminNotify.notifyUserById(
      userId,
      userOrderNoticeHtml({ kind: "expired", orderId: publicOrderId }),
    );
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
