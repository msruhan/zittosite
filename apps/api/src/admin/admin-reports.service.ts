import { Injectable } from "@nestjs/common";
import type { OrderStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const TZ = "Asia/Jakarta";
const CHANNEL_COLORS: Record<string, string> = {
  Website: "#2563EB",
  Telegram: "#18BFFF",
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

function jakartaYmd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Midnight Asia/Jakarta for the calendar day of `date`, as a UTC Date. */
function jakartaDayStart(date: Date): Date {
  return new Date(`${jakartaYmd(date)}T00:00:00+07:00`);
}

function addJakartaDays(dayStart: Date, days: number): Date {
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

  async summary() {
    const todayStart = jakartaDayStart(new Date());
    const windowStart = addJakartaDays(todayStart, -6);
    const tomorrowStart = addJakartaDays(todayStart, 1);

    const dayStarts = Array.from({ length: 7 }, (_, i) =>
      addJakartaDays(windowStart, i),
    );

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
      paidInWindow,
      paidAllWithService,
      admins,
      services,
    ] = await Promise.all([
      this.prisma.paymentInvoice.aggregate({
        where: { paymentStatus: "paid" },
        _sum: { amount: true },
      }),
      this.prisma.paymentInvoice.aggregate({
        where: {
          paymentStatus: "paid",
          paidAt: { gte: todayStart, lt: tomorrowStart },
        },
        _sum: { amount: true },
      }),
      this.prisma.order.count({
        where: { createdAt: { gte: todayStart, lt: tomorrowStart } },
      }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: "active" } }),
      this.prisma.order.count({ where: { status: "done" } }),
      this.prisma.order.count({ where: { status: "waiting_action" } }),
      this.prisma.order.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      this.prisma.order.findMany({
        where: { createdAt: { gte: windowStart, lt: tomorrowStart } },
        select: { createdAt: true, channel: true },
      }),
      this.prisma.paymentInvoice.findMany({
        where: {
          paymentStatus: "paid",
          paidAt: { gte: windowStart, lt: tomorrowStart },
        },
        select: { paidAt: true, amount: true },
      }),
      this.prisma.paymentInvoice.findMany({
        where: { paymentStatus: "paid" },
        select: {
          amount: true,
          order: { select: { service: { select: { name: true } } } },
        },
      }),
      this.prisma.admin.findMany({
        include: { _count: { select: { assignedOrders: true } } },
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

    const revenueSeries = dayStarts.map((day) => {
      const next = addJakartaDays(day, 1);
      const dayPaid = paidInWindow.filter(
        (inv) => inv.paidAt && inv.paidAt >= day && inv.paidAt < next,
      );
      return {
        label: formatDayLabel(day),
        revenue: dayPaid.reduce((sum, inv) => sum + inv.amount, 0),
        orders: dayPaid.length,
      };
    });

    let web = 0;
    let telegram = 0;
    for (const o of ordersInWindow) {
      if (o.channel === "telegram") telegram += 1;
      else web += 1;
    }
    const channelMix = [
      { name: "Website", amount: web, color: CHANNEL_COLORS.Website! },
      { name: "Telegram", amount: telegram, color: CHANNEL_COLORS.Telegram! },
    ].filter((item) => item.amount > 0);

    const serviceTotals = new Map<string, number>();
    for (const inv of paidAllWithService) {
      const name = inv.order?.service?.name ?? "Lainnya";
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
      kpis: {
        revenueTotal: revenueTotalAgg._sum.amount ?? 0,
        revenueToday: revenueTodayAgg._sum.amount ?? 0,
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
}
