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
  /**
   * Orders completed today: summed cost price (what the admin earns) for admin
   * stats, selling price for the WhatsApp processor.
   */
  doneAmount: number;
};

export type SuperAdminRecap = {
  day: Date;
  created: {
    total: number;
    web: number;
    telegram: number;
    /** By fulfillment channel of the service. */
    viaTelegram: number;
    viaWhatsapp: number;
    byStatus: Partial<Record<OrderStatus, number>>;
  };
  revenue: { amount: number; payments: number };
  handled: AdminDayStats;
  queue: number;
  /** WhatsApp-fulfilled orders handled by the group processor (no admin assignee). */
  whatsapp: AdminDayStats & { queue: number; orders: RecapOrderLine[] };
  perAdmin: Array<
    {
      adminId: string;
      fullName: string;
      telegramHandle: string | null;
      superAdmin: boolean;
      /** Selling price minus cost of today's done orders. */
      profit: number;
      orders: RecapOrderLine[];
    } & AdminDayStats
  >;
};

export type RecapOrderLine = {
  at: Date;
  imei: string;
  status: OrderStatus;
  service?: string;
};

export type OperatorRecap = {
  day: Date;
  stats: AdminDayStats;
  queue: number;
  orders: RecapOrderLine[];
};

type Counted = { assignedAdminId: string | null; _count: { _all: number } };
type Summed = {
  assignedAdminId: string | null;
  _sum: { costPrice: number | null; price?: number | null };
};

/** Totals skip unassigned orders: those belong to the WhatsApp processor, not an admin. */
function tally(rows: Counted[]) {
  const map = new Map<string, number>();
  let total = 0;
  for (const row of rows) {
    if (!row.assignedAdminId) continue;
    total += row._count._all;
    map.set(row.assignedAdminId, row._count._all);
  }
  return { map, total };
}

function sumByAdmin(rows: Summed[]) {
  const map = new Map<string, number>();
  let total = 0;
  for (const row of rows) {
    if (!row.assignedAdminId) continue;
    const amount = row._sum.costPrice ?? 0;
    total += amount;
    map.set(row.assignedAdminId, amount);
  }
  return { map, total };
}

type ActivityRow = {
  status: OrderStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
};

/** When the line's status happened: completion for done orders, last change for closed ones. */
function activityAt(o: ActivityRow): Date {
  if (o.status === "done") return o.completedAt ?? o.updatedAt;
  if (o.status === "rejected" || o.status === "cancel") return o.updatedAt;
  return o.startedAt ?? o.updatedAt;
}

function byTime(a: RecapOrderLine, b: RecapOrderLine) {
  return a.at.getTime() - b.at.getTime();
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
      taken: { startedAt: range, isTest: false } satisfies Prisma.OrderWhereInput,
      done: { status: "done", completedAt: range, isTest: false } satisfies Prisma.OrderWhereInput,
      rejected: {
        status: "rejected",
        updatedAt: range,
        isTest: false,
      } satisfies Prisma.OrderWhereInput,
      inProcess: { status: "in_process", isTest: false } satisfies Prisma.OrderWhereInput,
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

    const [
      byStatus,
      byChannel,
      paid,
      taken,
      done,
      rejected,
      inProcess,
      queue,
      handledOrders,
      doneAmounts,
    ] = await Promise.all([
        this.prisma.order.groupBy({
          by: ["status"],
          where: { createdAt: range, isTest: false },
          _count: { _all: true },
        }),
        this.prisma.order.groupBy({
          by: ["channel"],
          where: { createdAt: range, isTest: false },
          _count: { _all: true },
        }),
        this.prisma.paymentInvoice.aggregate({
          where: { purpose: "order", isTest: false, paymentStatus: "paid", paidAt: range },
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
            completedAt: true,
            updatedAt: true,
            service: { select: { name: true } },
          },
        }),
        this.prisma.order.groupBy({
          by: ["assignedAdminId"],
          where: where.done,
          _sum: { costPrice: true, price: true },
        }),
      ]);

    const viaWhatsappService = { service: { fulfillmentChannel: "whatsapp" } } as const;
    const processorOrder = { assignedAdminId: null, ...viaWhatsappService } as const;
    const countProcessor = (w: Prisma.OrderWhereInput) =>
      this.prisma.order.count({ where: { ...w, ...processorOrder } });
    const [viaWhatsapp, waTaken, waDone, waRejected, waInProcess, waQueue, waOrders, waAmount] =
      await Promise.all([
        this.prisma.order.count({
          where: { createdAt: range, isTest: false, ...viaWhatsappService },
        }),
        countProcessor(where.taken),
        countProcessor(where.done),
        countProcessor(where.rejected),
        countProcessor(where.inProcess),
        this.prisma.order.count({
          where: { status: "waiting_action", ...viaWhatsappService },
        }),
        this.prisma.order.findMany({
          where: {
            ...processorOrder,
            OR: [where.taken, where.done, where.rejected, where.inProcess],
          },
          select: {
            imei: true,
            status: true,
            startedAt: true,
            completedAt: true,
            updatedAt: true,
          },
        }),
        this.prisma.order.aggregate({
          where: { ...where.done, ...processorOrder },
          _sum: { price: true },
        }),
      ]);

    const ordersByAdmin = new Map<string, RecapOrderLine[]>();
    for (const o of handledOrders) {
      const list = ordersByAdmin.get(o.assignedAdminId!) ?? [];
      list.push({
        at: activityAt(o),
        imei: o.imei,
        status: o.status,
        service: o.service.name,
      });
      ordersByAdmin.set(o.assignedAdminId!, list);
    }
    for (const list of ordersByAdmin.values()) list.sort(byTime);

    const t = tally(taken);
    const d = tally(done);
    const r = tally(rejected);
    const p = tally(inProcess);
    const amounts = sumByAdmin(doneAmounts);
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
          select: { id: true, fullName: true, telegramUsername: true, role: true },
        })
      : [];
    const profits = new Map(
      doneAmounts.map((row) => [
        row.assignedAdminId,
        (row._sum.price ?? 0) - (row._sum.costPrice ?? 0),
      ]),
    );

    const perAdmin = admins
      .map((admin) => ({
        adminId: admin.id,
        fullName: admin.fullName,
        telegramHandle: admin.telegramUsername,
        superAdmin: admin.role === "super_admin",
        profit: profits.get(admin.id) ?? 0,
        taken: t.map.get(admin.id) ?? 0,
        done: d.map.get(admin.id) ?? 0,
        rejected: r.map.get(admin.id) ?? 0,
        inProcess: p.map.get(admin.id) ?? 0,
        doneAmount: amounts.map.get(admin.id) ?? 0,
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
        viaTelegram: total - viaWhatsapp,
        viaWhatsapp,
        byStatus: statusCounts,
      },
      revenue: { amount: paid._sum.amount ?? 0, payments: paid._count._all },
      handled: {
        taken: t.total,
        done: d.total,
        rejected: r.total,
        inProcess: p.total,
        doneAmount: amounts.total,
      },
      queue,
      whatsapp: {
        taken: waTaken,
        done: waDone,
        rejected: waRejected,
        inProcess: waInProcess,
        doneAmount: waAmount._sum.price ?? 0,
        queue: waQueue,
        orders: waOrders
          .map((o) => ({ at: activityAt(o), imei: o.imei, status: o.status }))
          .sort(byTime),
      },
      perAdmin,
    };
  }

  async operator(adminId: string): Promise<OperatorRecap> {
    const { start, range } = this.today();
    const where = this.activityWhere(range);
    const mine = (w: Prisma.OrderWhereInput) =>
      this.prisma.order.count({ where: { ...w, assignedAdminId: adminId } });

    const [taken, done, rejected, inProcess, queue, orders, amount] = await Promise.all([
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
          completedAt: true,
          updatedAt: true,
          service: { select: { name: true } },
        },
      }),
      this.prisma.order.aggregate({
        where: { ...where.done, assignedAdminId: adminId },
        _sum: { costPrice: true },
      }),
    ]);

    return {
      day: start,
      stats: { taken, done, rejected, inProcess, doneAmount: amount._sum.costPrice ?? 0 },
      queue,
      orders: orders
        .map((o) => ({
          at: activityAt(o),
          imei: o.imei,
          status: o.status,
          service: o.service.name,
        }))
        .sort(byTime),
    };
  }
}
