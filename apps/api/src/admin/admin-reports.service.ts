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

/**
 * Reports filter: Jakarta calendar days `from`..`to` (inclusive, YYYY-MM-DD);
 * `start`/`end` are the matching UTC instants, `end` exclusive.
 */
export type ReportPeriod = { from: string; to: string; start: Date; end: Date };

type Bucket = { label: string; start: Date; end: Date };

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
/** Ranges up to this many days chart per day; longer ones per month. */
const DAILY_CHART_MAX_DAYS = 62;
/** Finance table: per day up to 14 days, per week up to 92, per month beyond. */
const DAILY_TABLE_MAX_DAYS = 14;
const WEEKLY_TABLE_MAX_DAYS = 92;

function validYmd(value: string | undefined): value is string {
  if (!value || !YMD.test(value)) return false;
  const date = new Date(`${value}T00:00:00+07:00`);
  return !Number.isNaN(date.getTime()) && jakartaYmd(date) === value;
}

export function rangePeriod(from: string, to: string): ReportPeriod {
  const [a, b] = from <= to ? [from, to] : [to, from];
  const start = new Date(`${a}T00:00:00+07:00`);
  return { from: a, to: b, start, end: addJakartaDays(new Date(`${b}T00:00:00+07:00`), 1) };
}

/**
 * `dari`/`sampai` (YYYY-MM-DD, WIB) win; the older `tahun` (+ optional `bulan`)
 * still maps to that year or month. Anything invalid means "all time".
 */
export function parseReportPeriod(q: {
  dari?: string;
  sampai?: string;
  tahun?: string;
  bulan?: string;
}): ReportPeriod | undefined {
  if (validYmd(q.dari) || validYmd(q.sampai)) {
    const from = validYmd(q.dari) ? q.dari : q.sampai!;
    const to = validYmd(q.sampai) ? q.sampai : q.dari!;
    if (Number(from.slice(0, 4)) < 2000 || Number(to.slice(0, 4)) < 2000) return undefined;
    return rangePeriod(from, to);
  }
  const year = Number(q.tahun);
  const current = Number(jakartaYmd(new Date()).slice(0, 4));
  if (!/^\d{4}$/.test(q.tahun ?? "") || year < 2000 || year > current + 1) return undefined;
  const month = Number(q.bulan);
  if (/^\d{1,2}$/.test(q.bulan ?? "") && month >= 1 && month <= 12) {
    const first = `${year}-${String(month).padStart(2, "0")}-01`;
    const nextMonth = jakartaMonthStartOf(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1);
    return rangePeriod(first, jakartaYmd(addJakartaDays(nextMonth, -1)));
  }
  return rangePeriod(`${year}-01-01`, `${year}-12-31`);
}

function jakartaMonthStartOf(year: number, month: number): Date {
  return new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+07:00`);
}

function periodDays(period: ReportPeriod): number {
  return Math.round((period.end.getTime() - period.start.getTime()) / DAY_MS);
}

function formatYmd(ymd: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone: TZ, ...opts }).format(
    new Date(`${ymd}T12:00:00+07:00`),
  );
}

/** "3 Okt 2026", "Oktober 2026", "Tahun 2026", "1–15 Okt 2026", "28 Sep – 3 Okt 2026". */
export function formatPeriodLabel(period: ReportPeriod): string {
  const { from, to } = period;
  if (from === to) return formatYmd(from, { day: "numeric", month: "short", year: "numeric" });
  if (isFullYear(period)) return `Tahun ${from.slice(0, 4)}`;
  if (isFullMonth(period)) return formatYmd(from, { month: "long", year: "numeric" });
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  if (from.slice(0, 7) === to.slice(0, 7)) {
    return `${Number(from.slice(8))}–${formatYmd(to, { day: "numeric", month: "short", year: "numeric" })}`;
  }
  const full: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  const head = formatYmd(from, sameYear ? { day: "numeric", month: "short" } : full);
  return `${head} – ${formatYmd(to, full)}`;
}

function formatMonthShort(start: Date, withYear = false): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TZ,
    month: "short",
    ...(withYear ? { year: "2-digit" } : {}),
  }).format(start);
}

/** Calendar months overlapping the range, clipped to it. */
function monthBuckets(start: Date, end: Date): Bucket[] {
  const multiYear = jakartaYmd(start).slice(0, 4) !== jakartaYmd(addJakartaDays(end, -1)).slice(0, 4);
  const buckets: Bucket[] = [];
  for (let from = start; from < end; ) {
    const [y, m] = jakartaYmd(from).split("-").map(Number);
    const next = jakartaMonthStartOf(m === 12 ? y! + 1 : y!, m === 12 ? 1 : m! + 1);
    const to = next < end ? next : end;
    buckets.push({ label: formatMonthShort(from, multiYear), start: from, end: to });
    from = to;
  }
  return buckets;
}

function dayBuckets(start: Date, end: Date, withMonth: boolean): Bucket[] {
  const buckets: Bucket[] = [];
  for (let day = start; day < end; day = addJakartaDays(day, 1)) {
    buckets.push({
      label: withMonth ? formatDayLabel(day) : jakartaYmd(day).slice(8).replace(/^0/, ""),
      start: day,
      end: addJakartaDays(day, 1),
    });
  }
  return buckets;
}

/** Seven-day chunks from the first day: "1–7 Okt", "29 Sep–5 Okt". */
function weekBuckets(start: Date, end: Date): Bucket[] {
  const buckets: Bucket[] = [];
  for (let from = start; from < end; ) {
    const to = addJakartaDays(from, 7) < end ? addJakartaDays(from, 7) : end;
    const last = addJakartaDays(to, -1);
    const sameMonth = jakartaYmd(from).slice(0, 7) === jakartaYmd(last).slice(0, 7);
    const head = sameMonth ? String(Number(jakartaYmd(from).slice(8))) : formatDayLabel(from);
    buckets.push({ label: `${head}–${formatDayLabel(last)}`, start: from, end: to });
    from = to;
  }
  return buckets;
}

function chartBucketsFor(period: ReportPeriod): Bucket[] {
  const days = periodDays(period);
  if (days > DAILY_CHART_MAX_DAYS) return monthBuckets(period.start, period.end);
  const oneMonth = period.from.slice(0, 7) === period.to.slice(0, 7);
  return dayBuckets(period.start, period.end, !oneMonth);
}

function tableBucketsFor(period: ReportPeriod): Bucket[] {
  const days = periodDays(period);
  if (days <= DAILY_TABLE_MAX_DAYS) return dayBuckets(period.start, period.end, true);
  if (days <= WEEKLY_TABLE_MAX_DAYS) return weekBuckets(period.start, period.end);
  return monthBuckets(period.start, period.end);
}

function isFullMonth(period: ReportPeriod): boolean {
  return (
    period.from.endsWith("-01") &&
    period.from.slice(0, 7) === period.to.slice(0, 7) &&
    jakartaYmd(period.end).endsWith("-01")
  );
}

function isFullYear(period: ReportPeriod): boolean {
  return period.from.endsWith("-01-01") && period.to === `${period.from.slice(0, 4)}-12-31`;
}

/** Previous calendar month/year for whole months/years, else the same number of days before. */
function previousPeriod(period: ReportPeriod): ReportPeriod {
  if (isFullYear(period)) {
    const year = Number(period.from.slice(0, 4)) - 1;
    return rangePeriod(`${year}-01-01`, `${year}-12-31`);
  }
  if (isFullMonth(period)) {
    const lastDay = jakartaYmd(addJakartaDays(period.start, -1));
    return rangePeriod(`${lastDay.slice(0, 7)}-01`, lastDay);
  }
  const days = periodDays(period);
  const to = jakartaYmd(addJakartaDays(period.start, -1));
  const from = jakartaYmd(addJakartaDays(period.start, -days));
  return rangePeriod(from, to);
}

function serializePeriod(period: ReportPeriod) {
  return {
    from: period.from,
    to: period.to,
    days: periodDays(period),
    label: formatPeriodLabel(period),
  };
}

function bucketIndexOf(buckets: Bucket[], at: Date): number {
  return buckets.findIndex((b) => at >= b.start && at < b.end);
}

@Injectable()
export class AdminReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Years that have orders, newest first; always includes the current year. */
  private async reportYears(): Promise<number[]> {
    const current = Number(jakartaYmd(new Date()).slice(0, 4));
    const first = await this.prisma.order.findFirst({
      where: { isTest: false },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    const from = first ? Math.min(Number(jakartaYmd(first.createdAt).slice(0, 4)), current) : current;
    return Array.from({ length: current - from + 1 }, (_, i) => current - i);
  }

  async summary(viewerId: string, period?: ReportPeriod) {
    if (period) return this.periodSummary(viewerId, period);
    const years = await this.reportYears();
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
      years,
      period: null,
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

  /**
   * Reports for a date range; the breakdown is per day, week, or month depending
   * on its length. Sales count by completion date, orders by creation date.
   */
  private async periodSummary(viewerId: string, period: ReportPeriod) {
    const tableBuckets = tableBucketsFor(period);
    const chartBuckets = chartBucketsFor(period);
    const inRange = { gte: period.start, lt: period.end };

    const [
      years,
      viewer,
      earned,
      created,
      paidInvoices,
      admins,
      services,
      usersTotal,
      usersActive,
      waitingAction,
    ] = await Promise.all([
      this.reportYears(),
      this.prisma.admin.findUnique({ where: { id: viewerId }, select: { role: true } }),
      this.prisma.order.findMany({
        where: { ...EARNED_ORDER, completedAt: inRange },
        select: { price: true, costPrice: true, completedAt: true },
      }),
      this.prisma.order.findMany({
        where: { isTest: false, createdAt: inRange },
        select: { createdAt: true, channel: true, status: true },
      }),
      this.prisma.paymentInvoice.findMany({
        where: { purpose: "order", isTest: false, paymentStatus: "paid", paidAt: inRange },
        select: { orders: { select: { service: { select: { name: true } } }, take: 1 } },
      }),
      this.prisma.admin.findMany({
        include: {
          _count: {
            select: { assignedOrders: { where: { isTest: false, createdAt: inRange } } },
          },
        },
        orderBy: { fullName: "asc" },
      }),
      this.prisma.service.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, active: true, estimate: true, price: true },
      }),
      this.prisma.user.count({ where: { role: "customer" } }),
      this.prisma.user.count({ where: { status: "active", role: "customer" } }),
      this.prisma.order.count({ where: { status: "waiting_action", isTest: false } }),
    ]);
    const canSeeCost = viewer?.role === "super_admin";
    const visible = (money: Money) =>
      canSeeCost ? money : { ...money, cost: null, profit: null };

    const total = emptyMoney();
    const tableMoney = tableBuckets.map(() => emptyMoney());
    const chartMoney = chartBuckets.map(() => emptyMoney());
    for (const sale of earned) {
      const at = sale.completedAt!;
      addSale(total, sale);
      const t = bucketIndexOf(tableBuckets, at);
      if (t >= 0) addSale(tableMoney[t]!, sale);
      const c = bucketIndexOf(chartBuckets, at);
      if (c >= 0) addSale(chartMoney[c]!, sale);
    }

    const ordersPerChart = chartBuckets.map(() => 0);
    const channelCount = new Map<OrderChannel, number>();
    const statusCount = new Map<OrderStatus, number>();
    for (const order of created) {
      const c = bucketIndexOf(chartBuckets, order.createdAt);
      if (c >= 0) ordersPerChart[c]! += 1;
      channelCount.set(order.channel, (channelCount.get(order.channel) ?? 0) + 1);
      statusCount.set(order.status, (statusCount.get(order.status) ?? 0) + 1);
    }

    const serviceTotals = new Map<string, number>();
    for (const inv of paidInvoices) {
      const name = inv.orders[0]?.service?.name ?? "Lainnya";
      serviceTotals.set(name, (serviceTotals.get(name) ?? 0) + 1);
    }

    return {
      years,
      period: serializePeriod(period),
      finance: {
        canSeeCost,
        period: visible(total),
        breakdown: tableBuckets.map((bucket, i) => ({
          label: bucket.label,
          money: visible(tableMoney[i]!),
        })),
      },
      kpis: {
        ordersCreated: created.length,
        usersTotal,
        usersActive,
        ordersDone: total.orders,
        waitingAction,
      },
      channelMix: CHANNELS.map((c) => ({
        name: c.name,
        amount: channelCount.get(c.key) ?? 0,
        color: CHANNEL_COLORS[c.name]!,
      })).filter((item) => item.amount > 0),
      weeklyBars: chartBuckets.map((bucket, i) => ({ label: bucket.label, orders: ordersPerChart[i]! })),
      revenueSeries: chartBuckets.map((bucket, i) => ({
        label: bucket.label,
        revenue: chartMoney[i]!.revenue,
        orders: chartMoney[i]!.orders,
      })),
      serviceMix: [...serviceTotals.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, amount], index) => ({
          name,
          amount,
          color: SERVICE_PALETTE[index % SERVICE_PALETTE.length]!,
        })),
      byStatus: ALL_STATUSES.map((status) => ({ status, count: statusCount.get(status) ?? 0 })),
      adminPerformance: admins
        .map((admin) => {
          const handle = admin.telegramUsername?.trim();
          return {
            id: admin.id,
            fullName: admin.fullName,
            telegramHandle: handle ? (handle.startsWith("@") ? handle : `@${handle}`) : null,
            handledCount: admin._count.assignedOrders,
          };
        })
        .sort((a, b) => b.handledCount - a.handledCount),
      services,
    };
  }

  private async earnedMoney(where: Prisma.OrderWhereInput = {}): Promise<Money> {
    const agg = await this.prisma.order.aggregate({
      where: { ...EARNED_ORDER, ...where },
      _sum: { price: true, costPrice: true },
      _count: { _all: true },
    });
    const revenue = agg._sum.price ?? 0;
    const cost = agg._sum.costPrice ?? 0;
    return { revenue, cost, profit: revenue - cost, orders: agg._count._all };
  }

  /**
   * Super Admin dashboard: cost/profit and channel breakdowns (WIB calendar).
   * The finance card covers `period` (default: the current month) and the one before it.
   */
  async insights(period?: ReportPeriod) {
    const now = new Date();
    const todayStart = jakartaDayStart(now);
    const dailyStart = addJakartaDays(todayStart, -13);
    const mixStart = addJakartaDays(todayStart, -29);
    const monthStart = jakartaMonthStart(now);
    const selectedPeriod =
      period ??
      rangePeriod(
        jakartaYmd(monthStart),
        jakartaYmd(addJakartaDays(jakartaMonthStart(addJakartaDays(monthStart, 32)), -1)),
      );
    const selectedRange = selectedPeriod;
    const previousRange = previousPeriod(selectedPeriod);

    const [years, allTime, selected, previous, earned, created, services] = await Promise.all([
      this.reportYears(),
      this.earnedMoney(),
      this.earnedMoney({ completedAt: { gte: selectedRange.start, lt: selectedRange.end } }),
      this.earnedMoney({ completedAt: { gte: previousRange.start, lt: previousRange.end } }),
      this.prisma.order.findMany({
        where: { ...EARNED_ORDER, completedAt: { gte: mixStart } },
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
    const dayStarts = Array.from({ length: 14 }, (_, i) => addJakartaDays(dailyStart, i));
    const daily = dayStarts.map(() => emptyMoney());
    const byChannel = new Map<OrderChannel, Money>(CHANNELS.map((c) => [c.key, emptyMoney()]));
    const byService = new Map<string, Money>();
    const byUser = new Map<string, Money>();

    for (const sale of earned) {
      const at = sale.completedAt!;
      if (at >= todayStart) addSale(today, sale);
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

    return {
      years,
      finance: {
        period: serializePeriod(selectedPeriod),
        today,
        selected,
        previous,
        allTime,
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
