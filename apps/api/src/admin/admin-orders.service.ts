import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type OrderStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { serializeOrderListItem } from "../orders/orders.serializer";
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

  async list(viewerAdminId: string, q?: string, status?: string) {
    const redactUser = await this.redactFor(viewerAdminId);
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

    const rows = await this.prisma.order.findMany({
      where: {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(needle
          ? {
              OR: [
                { orderId: { contains: needle, mode: "insensitive" } },
                { imei: { contains: needle } },
                ...userSearch,
              ],
            }
          : {}),
      },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map((row) => serializeOrderListItem(row, { redactUser }));
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
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: next,
          ...(next === "done" && !order.completedAt
            ? { completedAt: new Date() }
            : {}),
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
    }
    return serializeOrderListItem(updated, {
      redactUser: admin.role !== "super_admin",
    });
  }

  /** Telegram fan-out for a website override: admin order cards, Super Admins, and the customer. */
  private notifyClosed(
    order: {
      id: string;
      orderId: string;
      userId: string;
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
