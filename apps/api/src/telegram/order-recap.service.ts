import { Injectable } from "@nestjs/common";
import type { OrderStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { addJakartaDays, jakartaDayStart } from "../admin/admin-reports.service";
import { assignedServiceFilter } from "../orders/orders.service";

export type AdminDayStats = {
  taken: number;
  done: number;
  rejected: number;
  inProcess: number;
};

export type SuperAdminRecap = {
  day: Date;
  created: {
    total: number;
    web: number;
    telegram: number;
    byStatus: Partial<Record<OrderStatus, number>>;
  };
  revenue: { amount: number; payments: number };
  handled: AdminDayStats;
  queue: number;
  perAdmin: Array<
    {
      adminId: string;
      fullName: string;
      telegramHandle: string | null;
      orders: RecapOrderLine[];
    } & AdminDayStats
  >;
};

export type RecapOrderLine = { at: Date; imei: string; status: OrderStatus };

export type OperatorRecap = {
  day: Date;
  stats: AdminDayStats;
  queue: number;
  orders: RecapOrderLine[];
};

type Counted = { assignedAdminId: string | null; _count: { _all: number } };

function tally(rows: Counted[]) {
  const map = new Map<string, number>();
  let total = 0;
  for (const row of rows) {
    total += row._count._all;
    if (row.assignedAdminId) map.set(row.assignedAdminId, row._count._all);
  }
  return { map, total };
}

/** Recap for the current Asia/Jakarta calendar day. */
@Injectable()
export class OrderRecapService {
  constructor(private readonly prisma: PrismaService) {}

  private today() {
    const start = jakartaDayStart(new Date());
    return { start, range: { gte: start, lt: addJakartaDays(start, 1) } };
  }

  private activityWhere(range: { gte: Date; lt: Date }) {
    return {
      taken: { startedAt: range } satisfies Prisma.OrderWhereInput,
      done: { status: "done", completedAt: range } satisfies Prisma.OrderWhereInput,
      rejected: { status: "rejected", updatedAt: range } satisfies Prisma.OrderWhereInput,
      inProcess: { status: "in_process" } satisfies Prisma.OrderWhereInput,
    };
  }

  async superAdmin(): Promise<SuperAdminRecap> {
    const { start, range } = this.today();
    const where = this.activityWhere(range);
    const groupByAdmin = (w: Prisma.OrderWhereInput) =>
      this.prisma.order.groupBy({
        by: ["assignedAdminId"],
        where: w,
        _count: { _all: true },
      });

    const [byStatus, byChannel, paid, taken, done, rejected, inProcess, queue, handledOrders] =
      await Promise.all([
        this.prisma.order.groupBy({
          by: ["status"],
          where: { createdAt: range },
          _count: { _all: true },
        }),
        this.prisma.order.groupBy({
          by: ["channel"],
          where: { createdAt: range },
          _count: { _all: true },
        }),
        this.prisma.paymentInvoice.aggregate({
          where: { paymentStatus: "paid", paidAt: range },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        groupByAdmin(where.taken),
        groupByAdmin(where.done),
        groupByAdmin(where.rejected),
        groupByAdmin(where.inProcess),
        this.prisma.order.count({ where: { status: "waiting_action" } }),
        this.prisma.order.findMany({
          where: {
            assignedAdminId: { not: null },
            OR: [where.taken, where.done, where.rejected, where.inProcess],
          },
          select: {
            assignedAdminId: true,
            imei: true,
            status: true,
            startedAt: true,
            updatedAt: true,
          },
          orderBy: [{ startedAt: "asc" }, { updatedAt: "asc" }],
        }),
      ]);

    const ordersByAdmin = new Map<string, RecapOrderLine[]>();
    for (const o of handledOrders) {
      const list = ordersByAdmin.get(o.assignedAdminId!) ?? [];
      list.push({ at: o.startedAt ?? o.updatedAt, imei: o.imei, status: o.status });
      ordersByAdmin.set(o.assignedAdminId!, list);
    }

    const t = tally(taken);
    const d = tally(done);
    const r = tally(rejected);
    const p = tally(inProcess);
    const adminIds = [
      ...new Set([
        ...t.map.keys(),
        ...d.map.keys(),
        ...r.map.keys(),
        ...p.map.keys(),
        ...ordersByAdmin.keys(),
      ]),
    ];
    const admins = adminIds.length
      ? await this.prisma.admin.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, fullName: true, telegramUsername: true },
        })
      : [];

    const perAdmin = admins
      .map((admin) => ({
        adminId: admin.id,
        fullName: admin.fullName,
        telegramHandle: admin.telegramUsername,
        taken: t.map.get(admin.id) ?? 0,
        done: d.map.get(admin.id) ?? 0,
        rejected: r.map.get(admin.id) ?? 0,
        inProcess: p.map.get(admin.id) ?? 0,
        orders: ordersByAdmin.get(admin.id) ?? [],
      }))
      .sort((a, b) => b.done + b.taken - (a.done + a.taken));

    const statusCounts: Partial<Record<OrderStatus, number>> = {};
    let total = 0;
    for (const row of byStatus) {
      statusCounts[row.status] = row._count._all;
      total += row._count._all;
    }
    const channelCount = (c: string) =>
      byChannel.find((row) => row.channel === c)?._count._all ?? 0;

    return {
      day: start,
      created: {
        total,
        web: channelCount("web"),
        telegram: channelCount("telegram"),
        byStatus: statusCounts,
      },
      revenue: { amount: paid._sum.amount ?? 0, payments: paid._count._all },
      handled: { taken: t.total, done: d.total, rejected: r.total, inProcess: p.total },
      queue,
      perAdmin,
    };
  }

  async operator(adminId: string): Promise<OperatorRecap> {
    const { start, range } = this.today();
    const where = this.activityWhere(range);
    const mine = (w: Prisma.OrderWhereInput) =>
      this.prisma.order.count({ where: { ...w, assignedAdminId: adminId } });

    const [taken, done, rejected, inProcess, queue, orders] = await Promise.all([
      mine(where.taken),
      mine(where.done),
      mine(where.rejected),
      mine(where.inProcess),
      this.prisma.order.count({
        where: { status: "waiting_action", ...assignedServiceFilter(adminId) },
      }),
      this.prisma.order.findMany({
        where: {
          assignedAdminId: adminId,
          OR: [where.taken, where.done, where.rejected, where.inProcess],
        },
        select: {
          status: true,
          imei: true,
          startedAt: true,
          updatedAt: true,
        },
        orderBy: [{ startedAt: "asc" }, { updatedAt: "asc" }],
      }),
    ]);

    return {
      day: start,
      stats: { taken, done, rejected, inProcess },
      queue,
      orders: orders.map((o) => ({
        at: o.startedAt ?? o.updatedAt,
        imei: o.imei,
        status: o.status,
      })),
    };
  }
}
