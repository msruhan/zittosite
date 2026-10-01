import { Injectable } from "@nestjs/common";
import type { OrderChannel, OrderStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/** Orders whose sale stands: done and not refunded through a failed result. */
const EARNED_ORDER: Prisma.OrderWhereInput = {
  isTest: false,
  status: "done",
  NOT: { result: { is: { resultStatus: "failed" } } },
};

const CHANNELS: { key: OrderChannel; name: string }[] = [
  { key: "web", name: "Website" },
  { key: "telegram", name: "Telegram" },
  { key: "api", name: "API" },
];

type Money = { revenue: number; cost: number; profit: number; orders: number };

function emptyMoney(): Money {
  return { revenue: 0, cost: 0, profit: 0, orders: 0 };
}

function addSale(target: Money, sale: { price: number; costPrice: number }) {
  target.revenue += sale.price;
  target.cost += sale.costPrice;
  target.profit += sale.price - sale.costPrice;
  target.orders += 1;
}

/** Index of the day bucket containing `at`, or -1 when before the first day. */
function dayIndexOf(dayStarts: Date[], at: Date): number {
  for (let i = dayStarts.length - 1; i >= 0; i -= 1) {
    if (at >= dayStarts[i]!) return i;
  }
  return -1;
}

function jakartaMonthStart(date: Date): Date {
  return new Date(`${jakartaYmd(date).slice(0, 7)}-01T00:00:00+07:00`);
}

const TZ = "Asia/Jakarta";
const CHANNEL_COLORS: Record<string, string> = {
  Website: "#1E63FF",
  Telegram: "#0E2F7D",
  API: "#A78BFA",
};
const SERVICE_PALETTE = [
  "#2563EB",
  "#1D4ED8",
  "#18BFFF",
  "#93C5FD",
  "#BFDBFE",
];

const ALL_STATUSES: OrderStatus[] = [
  "waiting_payment",
  "paid",
  "waiting_action",
  "in_process",
  "done",
  "rejected",
  "cancel",
];

export function jakartaYmd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Midnight Asia/Jakarta for the calendar day of `date`, as a UTC Date. */
export function jakartaDayStart(date: Date): Date {
  return new Date(`${jakartaYmd(date)}T00:00:00+07:00`);
}

export function addJakartaDays(dayStart: Date, days: number): Date {
  const [y, m, d] = jakartaYmd(dayStart).split("-").map(Number);
  const probe = new Date(Date.UTC(y!, m! - 1, d! + days, 12, 0, 0));
  return new Date(`${jakartaYmd(probe)}T00:00:00+07:00`);
}

function formatDayLabel(dayStart: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
  }).format(dayStart);
}

function formatWeekdayNarrow(dayStart: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TZ,
    weekday: "narrow",
  }).format(dayStart);
}

@Injectable()
export class AdminReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(viewerId: string) {
    const now = new Date();
    const todayStart = jakartaDayStart(now);
    const windowStart = addJakartaDays(todayStart, -6);
    const tomorrowStart = addJakartaDays(todayStart, 1);
    const monthStart = jakartaMonthStart(now);
    const prevMonthStart = jakartaMonthStart(addJakartaDays(monthStart, -1));
    const earnedFrom = prevMonthStart < windowStart ? prevMonthStart : windowStart;

    const dayStarts = Array.from({ length: 7 }, (_, i) =>
      addJakartaDays(windowStart, i),
    );

    const [viewer, earnedAllTime, earnedRecent] = await Promise.all([
      this.prisma.admin.findUnique({ where: { id: viewerId }, select: { role: true } }),
      this.prisma.order.aggregate({
        where: EARNED_ORDER,
        _sum: { price: true, costPrice: true },
        _count: { _all: true },
      }),
      this.prisma.order.findMany({
        where: { ...EARNED_ORDER, completedAt: { gte: earnedFrom } },
        select: { price: true, costPrice: true, completedAt: true },
      }),
    ]);
    const canSeeCost = viewer?.role === "super_admin";

    const today = emptyMoney();
    const month = emptyMoney();
    const prevMonth = emptyMoney();
    const daily = dayStarts.map(() => emptyMoney());
    for (const sale of earnedRecent) {
      const at = sale.completedAt!;
      if (at >= todayStart) addSale(today, sale);
      if (at >= monthStart) addSale(month, sale);
      else if (at >= prevMonthStart) addSale(prevMonth, sale);
      const dayIndex = dayIndexOf(dayStarts, at);
      if (dayIndex >= 0) addSale(daily[dayIndex]!, sale);
    }
    const allRevenue = earnedAllTime._sum.price ?? 0;
    const allCost = earnedAllTime._sum.costPrice ?? 0;
    const allTime: Money = {
      revenue: allRevenue,
      cost: allCost,
      profit: allRevenue - allCost,
      orders: earnedAllTime._count._all,
    };
    /** Plain admins see turnover only; cost and profit stay Super Admin data. */
    const visible = (money: Money) =>
      canSeeCost ? money : { ...money, cost: null, profit: null };

    const [
      revenueTotalAgg,
      revenueTodayAgg,
      ordersToday,
      usersTotal,
      usersActive,
      ordersDone,
      waitingAction,
      statusGroups,
      ordersInWindow,
      paidAllWithService,
      admins,
      services,
    ] = await Promise.all([
      this.prisma.paymentInvoice.aggregate({
        where: { purpose: "order", isTest: false, paymentStatus: "paid" },
        _sum: { amount: true, balanceUsed: true },
      }),
      this.prisma.paymentInvoice.aggregate({
        where: {
          purpose: "order", isTest: false,
          paymentStatus: "paid",
          paidAt: { gte: todayStart, lt: tomorrowStart },
        },
        _sum: { amount: true, balanceUsed: true },
      }),
      this.prisma.order.count({
        where: { createdAt: { gte: todayStart, lt: tomorrowStart }, isTest: false },
      }),
      this.prisma.user.count({ where: { role: "customer" } }),
      this.prisma.user.count({ where: { status: "active", role: "customer" } }),
      this.prisma.order.count({ where: { status: "done", isTest: false } }),
      this.prisma.order.count({ where: { status: "waiting_action", isTest: false } }),
      this.prisma.order.groupBy({
        by: ["status"],
        where: { isTest: false },
        _count: { _all: true },
      }),
      this.prisma.order.findMany({
        where: { createdAt: { gte: windowStart, lt: tomorrowStart }, isTest: false },
        select: { createdAt: true, channel: true },
      }),
      this.prisma.paymentInvoice.findMany({
        where: { purpose: "order", isTest: false, paymentStatus: "paid" },
        select: {
          amount: true,
          orders: {
            select: { service: { select: { name: true } } },
            take: 1,
          },
        },
      }),
      this.prisma.admin.findMany({
        include: {
          _count: { select: { assignedOrders: { where: { isTest: false } } } },
        },
        orderBy: { fullName: "asc" },
      }),
      this.prisma.service.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          active: true,
          estimate: true,
          price: true,
        },
      }),
    ]);

    const statusCount = new Map(
      statusGroups.map((row) => [row.status, row._count._all]),
    );

    const weeklyBars = dayStarts.map((day) => {
      const next = addJakartaDays(day, 1);
      const orders = ordersInWindow.filter(
        (o) => o.createdAt >= day && o.createdAt < next,
      ).length;
      return { label: formatWeekdayNarrow(day), orders };
    });

    const revenueSeries = dayStarts.map((day, i) => ({
      label: formatDayLabel(day),
      revenue: daily[i]!.revenue,
      orders: daily[i]!.orders,
    }));

    let web = 0;
    let telegram = 0;
    let apiCount = 0;
    for (const o of ordersInWindow) {
      if (o.channel === "telegram") telegram += 1;
      else if (o.channel === "api") apiCount += 1;
      else web += 1;
    }
    const channelMix = [
      { name: "Website", amount: web, color: CHANNEL_COLORS.Website! },
      { name: "Telegram", amount: telegram, color: CHANNEL_COLORS.Telegram! },
      { name: "API", amount: apiCount, color: CHANNEL_COLORS.API! },
    ].filter((item) => item.amount > 0);

    const serviceTotals = new Map<string, number>();
    for (const inv of paidAllWithService) {
      const name = inv.orders[0]?.service?.name ?? "Lainnya";
      serviceTotals.set(name, (serviceTotals.get(name) ?? 0) + 1);
    }
    const serviceMix = [...serviceTotals.entries()]
      .map(([name, amount], index) => ({
        name,
        amount,
        color: SERVICE_PALETTE[index % SERVICE_PALETTE.length]!,
      }))
      .sort((a, b) => b.amount - a.amount);

    const adminPerformance = admins
      .map((admin) => {
        const handle = admin.telegramUsername?.trim();
        return {
          id: admin.id,
          fullName: admin.fullName,
          telegramHandle: handle
            ? handle.startsWith("@")
              ? handle
              : `@${handle}`
            : null,
          handledCount: admin._count.assignedOrders,
        };
      })
      .sort((a, b) => b.handledCount - a.handledCount);

    return {
      finance: {
        canSeeCost,
        today: visible(today),
        month: visible(month),
        prevMonth: visible(prevMonth),
        allTime: visible(allTime),
      },
      kpis: {
        revenueTotal:
          (revenueTotalAgg._sum.amount ?? 0) - (revenueTotalAgg._sum.balanceUsed ?? 0),
        revenueToday:
          (revenueTodayAgg._sum.amount ?? 0) - (revenueTodayAgg._sum.balanceUsed ?? 0),
        ordersToday,
        usersTotal,
        usersActive,
        ordersDone,
        waitingAction,
      },
      channelMix,
      weeklyBars,
      revenueSeries,
      serviceMix,
      byStatus: ALL_STATUSES.map((status) => ({
        status,
        count: statusCount.get(status) ?? 0,
      })),
      adminPerformance,
      services,
    };
  }

  /** Super Admin dashboard: cost/profit and channel breakdowns (WIB calendar). */
  async insights() {
    const now = new Date();
    const todayStart = jakartaDayStart(now);
    const dailyStart = addJakartaDays(todayStart, -13);
    const mixStart = addJakartaDays(todayStart, -29);
    const monthStart = jakartaMonthStart(now);
    const prevMonthStart = jakartaMonthStart(addJakartaDays(monthStart, -1));
    const earnedFrom = prevMonthStart < mixStart ? prevMonthStart : mixStart;

    const [allTime, earned, created, services] = await Promise.all([
      this.prisma.order.aggregate({
        where: EARNED_ORDER,
        _sum: { price: true, costPrice: true },
        _count: { _all: true },
      }),
      this.prisma.order.findMany({
        where: { ...EARNED_ORDER, completedAt: { gte: earnedFrom } },
        select: {
          price: true,
          costPrice: true,
          completedAt: true,
          channel: true,
          serviceId: true,
          userId: true,
        },
      }),
      this.prisma.order.findMany({
        where: { isTest: false, createdAt: { gte: mixStart } },
        select: { createdAt: true, channel: true },
      }),
      this.prisma.service.findMany({
        select: { id: true, name: true, price: true, costPrice: true, active: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const today = emptyMoney();
    const month = emptyMoney();
    const prevMonth = emptyMoney();
    const dayStarts = Array.from({ length: 14 }, (_, i) => addJakartaDays(dailyStart, i));
    const daily = dayStarts.map(() => emptyMoney());
    const byChannel = new Map<OrderChannel, Money>(CHANNELS.map((c) => [c.key, emptyMoney()]));
    const byService = new Map<string, Money>();
    const byUser = new Map<string, Money>();

    for (const sale of earned) {
      const at = sale.completedAt!;
      if (at >= todayStart) addSale(today, sale);
      if (at >= monthStart) addSale(month, sale);
      else if (at >= prevMonthStart) addSale(prevMonth, sale);
      const dayIndex = dayIndexOf(dayStarts, at);
      if (dayIndex >= 0) addSale(daily[dayIndex]!, sale);
      if (at >= mixStart) {
        addSale(byChannel.get(sale.channel)!, sale);
        if (!byService.has(sale.serviceId)) byService.set(sale.serviceId, emptyMoney());
        addSale(byService.get(sale.serviceId)!, sale);
        if (!byUser.has(sale.userId)) byUser.set(sale.userId, emptyMoney());
        addSale(byUser.get(sale.userId)!, sale);
      }
    }

    const createdByChannel = new Map<OrderChannel, number>();
    const channelDaily = dayStarts.map((day) => ({
      label: formatDayLabel(day),
      web: 0,
      telegram: 0,
      api: 0,
    }));
    for (const order of created) {
      createdByChannel.set(order.channel, (createdByChannel.get(order.channel) ?? 0) + 1);
      const dayIndex = dayIndexOf(dayStarts, order.createdAt);
      if (dayIndex >= 0) channelDaily[dayIndex]![order.channel] += 1;
    }

    const topUserIds = [...byUser.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5);
    const topUserRows = await this.prisma.user.findMany({
      where: { id: { in: topUserIds.map(([id]) => id) } },
      select: { id: true, fullName: true, username: true },
    });
    const userById = new Map(topUserRows.map((u) => [u.id, u]));
    const serviceById = new Map(services.map((s) => [s.id, s]));

    const allRevenue = allTime._sum.price ?? 0;
    const allCost = allTime._sum.costPrice ?? 0;

    return {
      finance: {
        today,
        month,
        prevMonth,
        allTime: {
          revenue: allRevenue,
          cost: allCost,
          profit: allRevenue - allCost,
          orders: allTime._count._all,
        },
      },
      servicesWithoutCost: services
        .filter((s) => s.active && s.costPrice === 0)
        .map((s) => s.name),
      profitSeries: dayStarts.map((day, i) => ({
        label: formatDayLabel(day),
        ...daily[i]!,
      })),
      channelDaily,
      channels: CHANNELS.map((c) => ({
        key: c.key,
        name: c.name,
        color: CHANNEL_COLORS[c.name]!,
        created: createdByChannel.get(c.key) ?? 0,
        ...byChannel.get(c.key)!,
      })),
      serviceProfit: [...byService.entries()]
        .map(([id, money]) => ({
          id,
          name: serviceById.get(id)?.name ?? "Layanan dihapus",
          ...money,
        }))
        .sort((a, b) => b.profit - a.profit),
      topUsers: topUserIds.map(([id, money]) => ({
        id,
        fullName: userById.get(id)?.fullName ?? "User dihapus",
        username: userById.get(id)?.username ?? null,
        ...money,
      })),
    };
  }
}
