import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type OrderStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { serializeOrderListItem } from "../orders/orders.serializer";
import { SUPPLIER_ROUTED_ORDER } from "../orders/supplier-routed";
import {
  refundNote,
  refundOrderToBalance,
  reverseOrderRefund,
  reversalNote,
  type RefundReason,
} from "../orders/balance";
import { AuditLogService } from "../security/audit-log.service";
import { AdminNotifyService } from "../telegram/admin-notify.service";
import { userOrderNoticeHtml } from "../telegram/telegram-messages";
import { processDurationLabel } from "../orders/process-duration";
import { ORDER_STATUS_LABEL, buildOrdersWorkbook, wibStamp } from "./order-export";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DONE_NOTE = "Order selesai diproses.";

/** `YYYY-MM-DD` as midnight in Asia/Jakarta (UTC+7, no DST); null when absent or malformed. */
export function jakartaDayStart(value?: string): Date | null {
  const day = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = new Date(`${day}T00:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

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
  supplier: { select: { name: true } },
} satisfies Prisma.OrderInclude;

const exportInclude = {
  service: { select: { name: true, fulfillmentChannel: true, menu: true, inputType: true } },
  user: { select: { fullName: true, username: true } },
  assignedAdmin: { select: { fullName: true } },
  invoice: { select: { invoiceId: true, paymentStatus: true, paidAt: true } },
  result: { select: { resultStatus: true, resultNote: true } },
  supplier: { select: { name: true } },
} satisfies Prisma.OrderInclude;

const EXPORT_LIMIT = 20_000;

type OrderListFilters = { adminId?: string; from?: string; to?: string };

const ALL_STATUSES: OrderStatus[] = [
  "waiting_payment",
  "paid",
  "waiting_action",
  "in_process",
  "done",
  "rejected",
  "cancel",
];

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly adminNotify: AdminNotifyService,
  ) {}

  private async redactFor(viewerAdminId: string): Promise<boolean> {
    const viewer = await this.prisma.admin.findUnique({
      where: { id: viewerAdminId },
      select: { role: true },
    });
    return viewer?.role !== "super_admin";
  }

  async list(
    viewerAdminId: string,
    q?: string,
    status?: string,
    supplierOnly = false,
    filters: OrderListFilters = {},
  ) {
    const redactUser = await this.redactFor(viewerAdminId);
    const rows = await this.prisma.order.findMany({
      where: this.listWhere(redactUser, q, status, supplierOnly, filters),
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map((row) => serializeOrderListItem(row, { redactUser }));
  }

  /** Super Admin Excel export of the Orders page, honouring the same filters as {@link list}. */
  async exportXlsx(
    adminId: string,
    q?: string,
    status?: string,
    filters: OrderListFilters = {},
  ) {
    const admin = await this.prisma.admin.findUniqueOrThrow({
      where: { id: adminId },
      select: { fullName: true },
    });
    const rows = await this.prisma.order.findMany({
      where: this.listWhere(false, q, status, false, filters),
      include: exportInclude,
      orderBy: { createdAt: "desc" },
      take: EXPORT_LIMIT + 1,
    });
    const truncated = rows.length > EXPORT_LIMIT;
    const kept = truncated ? rows.slice(0, EXPORT_LIMIT) : rows;

    const labels: string[] = [];
    const needle = String(q ?? "").trim();
    if (needle) labels.push(`Cari "${needle}"`);
    if (status && ORDER_STATUS_LABEL[status]) labels.push(`Status ${ORDER_STATUS_LABEL[status]}`);
    const handler = String(filters.adminId ?? "").trim();
    if (handler === "none") labels.push("Tanpa admin");
    else if (handler) {
      const picked = await this.prisma.admin.findUnique({
        where: { id: handler },
        select: { fullName: true },
      });
      labels.push(`Admin ${picked?.fullName ?? handler}`);
    }
    if (jakartaDayStart(filters.from)) labels.push(`Dari ${filters.from}`);
    if (jakartaDayStart(filters.to)) labels.push(`Sampai ${filters.to}`);

    const exportedAt = new Date();
    const buffer = await buildOrdersWorkbook(kept, {
      exportedAt,
      exportedBy: admin.fullName,
      filters: labels,
      truncated,
      limit: EXPORT_LIMIT,
    });
    this.audit.record("admin.orders.exported", {
      actorId: adminId,
      count: kept.length,
      filters: labels.join(", ") || undefined,
    });
    return { buffer, filename: `orders-${wibStamp(exportedAt)}.xlsx` };
  }

  private listWhere(
    redactUser: boolean,
    q: string | undefined,
    status: string | undefined,
    supplierOnly: boolean,
    filters: OrderListFilters,
  ): Prisma.OrderWhereInput {
    const adminId = String(filters.adminId ?? "").trim();
    const from = jakartaDayStart(filters.from);
    const toStart = jakartaDayStart(filters.to);
    const until = toStart ? new Date(toStart.getTime() + DAY_MS) : null;
    const needle = String(q ?? "").trim();
    const statusFilter =
      status && ALL_STATUSES.includes(status as OrderStatus)
        ? (status as OrderStatus)
        : undefined;

    const userSearch =
      !redactUser && needle
        ? [
            {
              user: {
                OR: [
                  { fullName: { contains: needle, mode: "insensitive" as const } },
                  { username: { contains: needle, mode: "insensitive" as const } },
                ],
              },
            },
          ]
        : [];

    return {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(supplierOnly ? { AND: [SUPPLIER_ROUTED_ORDER] } : {}),
      ...(adminId ? { assignedAdminId: adminId === "none" ? null : adminId } : {}),
      ...(from || until
        ? { createdAt: { ...(from ? { gte: from } : {}), ...(until ? { lt: until } : {}) } }
        : {}),
      ...(needle
        ? {
            OR: [
              { orderId: { contains: needle, mode: "insensitive" } },
              { imei: { contains: needle } },
              ...userSearch,
            ],
          }
        : {}),
    };
  }

  /** Admins who have handled at least one order, for the Orders filter. */
  async handlers() {
    return this.prisma.admin.findMany({
      where: { assignedOrders: { some: {} } },
      select: { id: true, fullName: true, username: true },
      orderBy: { fullName: "asc" },
    });
  }

  async get(viewerAdminId: string, publicOrderId: string) {
    const redactUser = await this.redactFor(viewerAdminId);
    const order = await this.prisma.order.findUnique({
      where: { orderId: publicOrderId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException("Order tidak ditemukan.");
    return serializeOrderListItem(order, { redactUser });
  }

  async overrideStatus(
    adminId: string,
    publicOrderId: string,
    status: string,
    note?: string,
  ) {
    if (!ALL_STATUSES.includes(status as OrderStatus)) {
      throw new BadRequestException("Status tidak valid.");
    }
    const admin = await this.prisma.admin.findUniqueOrThrow({
      where: { id: adminId },
    });
    const order = await this.prisma.order.findUnique({
      where: { orderId: publicOrderId },
      include: { result: { select: { resultStatus: true } } },
    });
    if (!order) throw new NotFoundException("Order tidak ditemukan.");

    const next = status as OrderStatus;
    const refundReason: RefundReason | null =
      next === "rejected"
        ? "order_rejected"
        : next === "cancel"
          ? "order_cancelled"
          : next === "done" && order.result?.resultStatus === "failed"
            ? "order_failed"
            : null;
    const { updated, refunded, reversed } = await this.prisma.$transaction(async (tx) => {
      const refunded = refundReason
        ? await refundOrderToBalance(tx, order, refundReason)
        : 0;
      const reversed = refundReason ? 0 : await reverseOrderRefund(tx, order);
      const reopened = order.status === "done" && next !== "done";
      if (reopened) {
        // A reopened order must accept a fresh result (OrderResult is one per order).
        await tx.orderResult.deleteMany({ where: { orderId: order.id } });
      }
      if (next === "done" && !order.result) {
        await tx.orderResult.create({
          data: {
            orderId: order.id,
            resultStatus: "success",
            resultNote: DEFAULT_DONE_NOTE,
            createdByAdminId: admin.id,
          },
        });
      }
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: next,
          ...(next === "done" && !order.completedAt
            ? { completedAt: new Date() }
            : {}),
          ...(reopened ? { completedAt: null } : {}),
          ...(next === "in_process" && !order.startedAt
            ? { startedAt: new Date() }
            : {}),
          activity: {
            create: {
              status: next,
              note:
                (String(note ?? "").trim() ||
                  `Status diubah manual oleh Super Admin menjadi ${next}.`) +
                refundNote(refunded) +
                reversalNote(reversed),
              actor: admin.fullName,
            },
          },
        },
        include: orderInclude,
      });
      return { updated, refunded, reversed };
    });
    if (refunded > 0) {
      this.audit.record("balance.refunded", {
        actorId: adminId,
        userId: updated.userId,
        orderId: updated.orderId,
        amount: refunded,
        reason: refundReason ?? undefined,
      });
    }
    if (reversed > 0) {
      this.audit.record("balance.refund_reversed", {
        actorId: adminId,
        userId: updated.userId,
        orderId: updated.orderId,
        amount: reversed,
        status: next,
      });
    }
    if (order.status !== next && (next === "rejected" || next === "cancel")) {
      this.notifyClosed(updated, next, admin, refunded, order.status !== "waiting_payment");
    } else if (order.status !== next && (next === "in_process" || next === "done")) {
      this.notifyProgress(updated, next, admin, refunded);
    }
    return serializeOrderListItem(updated, {
      redactUser: admin.role !== "super_admin",
    });
  }

  /** Same Telegram fan-out as {@link notifyClosed}, for overrides to in_process or done. */
  private notifyProgress(
    order: {
      id: string;
      orderId: string;
      userId: string;
      imei: string;
      service: { name: string };
      assignedAdmin: { fullName: string } | null;
      result: { resultStatus: string; resultNote: string } | null;
      createdAt: Date;
      invoice: { paidAt: Date | null } | null;
      activity: Array<{ status: string; createdAt: Date }>;
    },
    next: "in_process" | "done",
    admin: { id: string; username: string; fullName: string },
    refunded: number,
  ) {
    const actorName = order.assignedAdmin?.fullName ?? admin.fullName;
    if (next === "in_process") {
      void this.adminNotify.syncOrderCards(order.id, "taken", { actorName });
      void this.adminNotify.notifySuperAdminsFollowUp(order.id, "taken", admin, undefined, {
        includeActor: true,
      });
      void this.adminNotify.notifyUserById(
        order.userId,
        userOrderNoticeHtml({ kind: "taken", orderId: order.orderId }),
      );
      return;
    }

    const resultNote = order.result?.resultNote ?? DEFAULT_DONE_NOTE;
    const typedNote = resultNote === DEFAULT_DONE_NOTE ? "" : resultNote;
    void this.adminNotify.syncOrderCards(order.id, "done", { actorName, note: resultNote });
    void this.adminNotify.notifySuperAdminsFollowUp(order.id, "done", admin, resultNote, {
      includeActor: true,
    });
    void this.adminNotify.notifyUserById(
      order.userId,
      userOrderNoticeHtml({
        kind: "done",
        orderId: order.orderId,
        imei: order.imei,
        serviceName: order.service.name,
        resultStatus: order.result?.resultStatus ?? "success",
        note: typedNote,
        refund: refunded,
        duration: processDurationLabel(order),
      }),
    );
  }

  /** Telegram fan-out for a website override: admin order cards, Super Admins, and the customer. */
  private notifyClosed(
    order: {
      id: string;
      orderId: string;
      userId: string;
      imei: string;
      service: { name: string };
      statusReason: string | null;
      createdAt: Date;
      invoice: { paidAt: Date | null } | null;
      activity: Array<{ status: string; createdAt: Date }>;
    },
    next: "rejected" | "cancel",
    admin: { id: string; username: string; fullName: string },
    refunded: number,
    wasPaid: boolean,
  ) {
    const reason = order.statusReason?.trim() || undefined;
    const kind = next === "rejected" ? "rejected" : "cancelled";
    void this.adminNotify.syncOrderCards(order.id, kind, {
      actorName: admin.fullName,
      note: reason,
    });
    void this.adminNotify.notifySuperAdminsFollowUp(order.id, kind, admin, reason, {
      includeActor: true,
    });
    void this.adminNotify.notifyUserById(
      order.userId,
      next === "rejected"
        ? userOrderNoticeHtml({
            kind: "rejected",
            orderId: order.orderId,
            imei: order.imei,
            serviceName: order.service.name,
            reason,
            refund: refunded,
            duration: processDurationLabel(order),
          })
        : userOrderNoticeHtml({
            kind: "cancelled",
            orderId: order.orderId,
            reason: reason ?? "Dibatalkan oleh Super Admin.",
            wasPaid,
            refund: refunded,
          }),
    );
  }

  /** Super Admin edits the keterangan of a closed order; the customer is not notified. */
  async updateStatusReason(
    adminId: string,
    publicOrderId: string,
    reason: string | null,
  ) {
    const admin = await this.prisma.admin.findUniqueOrThrow({
      where: { id: adminId },
    });
    const order = await this.prisma.order.findUnique({
      where: { orderId: publicOrderId },
    });
    if (!order) throw new NotFoundException("Order tidak ditemukan.");
    if (order.status !== "rejected" && order.status !== "cancel") {
      throw new BadRequestException(
        "Keterangan hanya untuk order yang ditolak atau dibatalkan.",
      );
    }

    const next = String(reason ?? "").trim() || null;
    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        statusReason: next,
        activity: {
          create: {
            status: order.status,
            note: next
              ? `Keterangan diubah: ${next}`
              : "Keterangan dihapus (tidak ada keterangan).",
            actor: admin.fullName,
          },
        },
      },
      include: orderInclude,
    });
    return serializeOrderListItem(updated);
  }

  async dashboardStats(viewerAdminId: string) {
    const redactUser = await this.redactFor(viewerAdminId);
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      waitingAction,
      inProcess,
      done,
      ordersToday,
      users,
      services,
      paidToday,
      recent,
    ] = await Promise.all([
      this.prisma.order.count({ where: { isTest: false } }),
      this.prisma.order.count({ where: { status: "waiting_action", isTest: false } }),
      this.prisma.order.count({ where: { status: "in_process", isTest: false } }),
      this.prisma.order.count({ where: { status: "done", isTest: false } }),
      this.prisma.order.count({ where: { createdAt: { gte: start }, isTest: false } }),
      this.prisma.user.count({ where: { role: "customer" } }),
      this.prisma.service.count({ where: { active: true } }),
      this.prisma.paymentInvoice.aggregate({
        where: { purpose: "order", isTest: false, paymentStatus: "paid", paidAt: { gte: start } },
        _sum: { amount: true },
      }),
      this.prisma.order.findMany({
        include: orderInclude,
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);

    return {
      totalOrders,
      waitingAction,
      inProcess,
      done,
      ordersToday,
      totalUsers: users,
      activeServices: services,
      revenueToday: paidToday._sum.amount ?? 0,
      recentOrders: recent.map((row) =>
        serializeOrderListItem(row, { redactUser }),
      ),
    };
  }
}
