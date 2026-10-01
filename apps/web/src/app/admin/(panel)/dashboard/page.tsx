import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  ClockCountdown,
  CurrencyCircleDollar,
  Package,
  Users,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DataValue } from "@/components/ui/data-value";
import { StatusBadge, Tag } from "@/components/ui/status-badge";
import { DonutChart } from "@/components/domain/donut-chart";
import {
  CHANNEL_COLOR,
  ChannelTrendChart,
  ProfitChart,
} from "@/components/domain/insight-charts";
import { cn } from "@/lib/utils";
import {
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableScroll,
} from "@/components/ui/table";
import { StatGrid, StatTile } from "@/components/domain/stat-tile";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import { formatDateTime, formatRupiah } from "@/lib/format";
import type { OrderDetail } from "@/lib/types";

export const metadata: Metadata = {
  title: "Dashboard Super Admin",
};

type DashboardStats = {
  totalOrders: number;
  waitingAction: number;
  inProcess: number;
  done: number;
  ordersToday: number;
  totalUsers: number;
  activeServices: number;
  revenueToday: number;
  recentOrders: OrderDetail[];
};

type Money = { revenue: number; cost: number; profit: number; orders: number };

type DashboardInsights = {
  finance: { today: Money; month: Money; prevMonth: Money; allTime: Money };
  servicesWithoutCost: string[];
  profitSeries: (Money & { label: string })[];
  channelDaily: { label: string; web: number; telegram: number; api: number }[];
  channels: (Money & {
    key: "web" | "telegram" | "api";
    name: string;
    created: number;
  })[];
  serviceProfit: (Money & { id: string; name: string })[];
  topUsers: (Money & {
    id: string;
    fullName: string;
    username: string | null;
  })[];
};

async function loadInsights(): Promise<DashboardInsights | null> {
  try {
    return await serverApi<DashboardInsights>("/admin/dashboard/insights");
  } catch (err) {
    if (err instanceof ApiError && err.status !== 401) return null;
    throw err;
  }
}

function marginPct(money: Money): number {
  return money.revenue > 0 ? Math.round((money.profit / money.revenue) * 100) : 0;
}

function pct(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function MetricStrip({
  metrics,
}: {
  metrics: Array<{ label: string; value: ReactNode; helper?: string }>;
}) {
  return (
    <div className="grid grid-cols-3 border-t border-hairline">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="min-w-0 border-r border-hairline p-3 last:border-r-0 sm:p-4"
        >
          <p className="truncate text-label text-ink-soft">{metric.label}</p>
          <p className="mt-1 truncate font-data text-title text-ink sm:text-metric">{metric.value}</p>
          {metric.helper ? (
            <p className="mt-1 hidden text-label text-ink-faint sm:block">{metric.helper}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  helper,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  helper: string;
}) {
  return (
    <Card className="transition-[background-color,border-color,box-shadow] duration-150 hover:border-action/20 hover:bg-white hover:shadow-lifted">
      <CardBody>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-label text-ink-soft">{label}</p>
            <DataValue
              emphasis
              className="mt-2 block text-metric"
            >
              {value}
            </DataValue>
          </div>
          <span className="grid size-8 place-items-center rounded-md border border-action/15 bg-action-wash text-action">
            {icon}
          </span>
        </div>
        <p className="mt-4 border-t border-hairline pt-3 text-label text-ink-soft">
          {helper}
        </p>
      </CardBody>
    </Card>
  );
}

function FinanceSummaryCard({ insights }: { insights: DashboardInsights }) {
  const { today, month, prevMonth, allTime } = insights.finance;
  const change =
    prevMonth.profit > 0
      ? Math.round(((month.profit - prevMonth.profit) / prevMonth.profit) * 1000) / 10
      : null;
  const monthName = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <Card>
      <CardBody className="p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-label text-ink-soft">Untung bersih · {monthName}</p>
            <p
              className={cn(
                "mt-2 font-data text-display",
                month.profit < 0 ? "text-refused-ink" : "text-ink",
              )}
            >
              {formatRupiah(month.profit)}
            </p>
          </div>
          {change !== null ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-label font-bold",
                change >= 0
                  ? "border-cleared-edge bg-cleared-wash text-cleared-ink"
                  : "border-refused-edge bg-refused-wash text-refused-ink",
              )}
            >
              {change >= 0 ? (
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              ) : (
                <ArrowDownRight className="size-3.5" aria-hidden="true" />
              )}
              {change >= 0 ? "+" : ""}
              {change}% vs bulan lalu
            </span>
          ) : null}
        </div>

        <dl className="mt-5 grid grid-cols-3 divide-x divide-hairline rounded-card border border-hairline bg-mist/40">
          <div className="p-3 sm:p-4">
            <dt className="text-label text-ink-soft">Pendapatan</dt>
            <dd className="mt-1 truncate font-data text-title text-ink">
              {formatRupiah(month.revenue)}
            </dd>
            <dd className="text-label text-ink-faint">{month.orders} order sukses</dd>
          </div>
          <div className="p-3 sm:p-4">
            <dt className="text-label text-ink-soft">Modal</dt>
            <dd className="mt-1 truncate font-data text-title text-ink">
              {formatRupiah(month.cost)}
            </dd>
            <dd className="text-label text-ink-faint">Biaya ke penyedia</dd>
          </div>
          <div className="p-3 sm:p-4">
            <dt className="text-label text-ink-soft">Margin</dt>
            <dd className="mt-1 font-data text-title text-ink">{marginPct(month)}%</dd>
            <dd className="text-label text-ink-faint">Untung ÷ pendapatan</dd>
          </div>
        </dl>

        <div className="mt-4 grid gap-2 text-body sm:grid-cols-2">
          <p className="text-ink-soft">
            Hari ini:{" "}
            <DataValue emphasis className="text-ink">
              {formatRupiah(today.profit)}
            </DataValue>{" "}
            dari {today.orders} order
          </p>
          <p className="text-ink-soft sm:text-right">
            Sepanjang waktu:{" "}
            <DataValue emphasis className="text-ink">
              {formatRupiah(allTime.profit)}
            </DataValue>
          </p>
        </div>

        {insights.servicesWithoutCost.length > 0 ? (
          <p className="mt-4 flex items-start gap-2 rounded-md border border-hold-edge bg-hold-wash px-3 py-2 text-label text-hold-ink">
            <WarningCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Harga modal belum diisi untuk {insights.servicesWithoutCost.join(", ")}.
              Untung layanan ini dihitung penuh sampai modal diisi di{" "}
              <Link href="/admin/services" className="font-bold underline">
                Services
              </Link>
              .
            </span>
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

function InsightSections({ insights }: { insights: DashboardInsights }) {
  const profit14 = insights.profitSeries.reduce(
    (sum, day) => ({
      revenue: sum.revenue + day.revenue,
      cost: sum.cost + day.cost,
      profit: sum.profit + day.profit,
    }),
    { revenue: 0, cost: 0, profit: 0 },
  );
  const channelSlices = insights.channels
    .filter((c) => c.created > 0)
    .map((c) => ({ name: c.name, amount: c.created, color: CHANNEL_COLOR[c.key] }));
  const maxUserRevenue = Math.max(1, ...insights.topUsers.map((u) => u.revenue));

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="items-start">
            <div className="min-w-0">
              <CardTitle>Pendapatan, modal & untung</CardTitle>
              <p className="mt-1 text-body text-ink-soft">
                Order selesai sukses per hari, 14 hari terakhir.
              </p>
            </div>
            <div className="text-right">
              <p className="font-data text-headline text-cleared-ink">
                {formatRupiah(profit14.profit)}
              </p>
              <p className="text-label text-ink-soft">
                dari {formatRupiah(profit14.revenue)}
              </p>
            </div>
          </CardHeader>
          <CardBody className="pt-2">
            <ProfitChart data={insights.profitSeries} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order per kanal</CardTitle>
            <Tag>30 hari</Tag>
          </CardHeader>
          <CardBody className="pt-2">
            {channelSlices.length > 0 ? (
              <DonutChart data={channelSlices} centerLabel="Order" />
            ) : (
              <p className="py-10 text-center text-body text-ink-soft">
                Belum ada order 30 hari terakhir.
              </p>
            )}
            <ul className="mt-5 divide-y divide-hairline border-t border-hairline">
              {insights.channels.map((channel) => (
                <li
                  key={channel.key}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="flex items-center gap-2 text-body font-medium text-ink">
                    <span
                      aria-hidden="true"
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: CHANNEL_COLOR[channel.key] }}
                    />
                    {channel.name}
                  </span>
                  <span className="text-right text-label text-ink-soft">
                    <DataValue emphasis className="text-ink">
                      {channel.created}
                    </DataValue>{" "}
                    order · untung{" "}
                    <DataValue className="text-cleared-ink">
                      {formatRupiah(channel.profit)}
                    </DataValue>
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="items-start">
            <div className="min-w-0">
              <CardTitle>Tren order per kanal</CardTitle>
              <p className="mt-1 text-body text-ink-soft">
                Order masuk per hari dari Website, bot Telegram, dan API.
              </p>
            </div>
            <Tag>14 hari</Tag>
          </CardHeader>
          <CardBody className="pt-2">
            <ChannelTrendChart data={insights.channelDaily} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User teratas</CardTitle>
            <Tag>30 hari</Tag>
          </CardHeader>
          <CardBody className="pt-3">
            {insights.topUsers.length > 0 ? (
              <ol className="space-y-3.5">
                {insights.topUsers.map((user, index) => (
                  <li key={user.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 truncate text-body font-medium text-ink">
                        <span className="mr-2 font-data text-label text-ink-faint">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {user.fullName}
                        {user.username ? (
                          <span className="ml-1.5 font-data text-label text-ink-soft">
                            @{user.username}
                          </span>
                        ) : null}
                      </p>
                      <DataValue emphasis className="shrink-0">
                        {formatRupiah(user.revenue)}
                      </DataValue>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-mist">
                      <div
                        className="h-full rounded-full bg-action"
                        style={{ width: `${(user.revenue / maxUserRevenue) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1 text-label text-ink-soft">
                      {user.orders} order · untung {formatRupiah(user.profit)}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="py-10 text-center text-body text-ink-soft">
                Belum ada order sukses 30 hari terakhir.
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Untung per layanan</CardTitle>
          <Tag>30 hari</Tag>
        </CardHeader>
        <div className="mt-4 border-t border-hairline">
          {insights.serviceProfit.length > 0 ? (
            <TableScroll>
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Layanan</TH>
                    <TH className="text-right">Order</TH>
                    <TH className="text-right">Pendapatan</TH>
                    <TH className="text-right">Modal</TH>
                    <TH className="text-right">Untung</TH>
                    <TH className="text-right">Margin</TH>
                  </TR>
                </THead>
                <TBody>
                  {insights.serviceProfit.map((row) => (
                    <TR key={row.id}>
                      <TD className="font-medium text-ink">{row.name}</TD>
                      <TD className="text-right">
                        <DataValue>{row.orders}</DataValue>
                      </TD>
                      <TD className="text-right">
                        <DataValue>{formatRupiah(row.revenue)}</DataValue>
                      </TD>
                      <TD className="text-right">
                        <DataValue className="text-ink-soft">
                          {formatRupiah(row.cost)}
                        </DataValue>
                      </TD>
                      <TD className="text-right">
                        <DataValue
                          emphasis
                          className={row.profit < 0 ? "text-refused-ink" : "text-cleared-ink"}
                        >
                          {formatRupiah(row.profit)}
                        </DataValue>
                      </TD>
                      <TD className="text-right">
                        <DataValue>{marginPct(row)}%</DataValue>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableScroll>
          ) : (
            <p className="py-10 text-center text-body text-ink-soft">
              Belum ada order sukses 30 hari terakhir.
            </p>
          )}
        </div>
      </Card>
    </>
  );
}

export default async function AdminDashboardPage() {
  let stats: DashboardStats;
  let insights: DashboardInsights | null;
  try {
    [stats, insights] = await Promise.all([
      serverApi<DashboardStats>("/admin/dashboard/stats"),
      loadInsights(),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/admin/login");
    throw err;
  }

  const queueDepth = stats.waitingAction + stats.inProcess;
  const completionRate = pct(stats.done, stats.totalOrders);
  const liveOrders = stats.recentOrders.slice(0, 4);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="rounded-card border border-hairline bg-surface shadow-resting">
          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div>
              <p className="text-label font-bold text-action">ZITTOSITE / ADMIN OPERATIONS</p>
              <h1 className="mt-2 text-display text-ink">
                Dashboard kendali order.
              </h1>
              <p className="mt-2 max-w-[68ch] text-body text-ink-soft">
                Ringkasan antrean, pengerjaan, dan pendapatan hari ini dalam satu
                panel kontrol untuk Super Admin.
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-rail p-4 text-white">
              <p className="text-label text-white/50">Operational state</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="font-data text-headline text-white">{queueDepth}</p>
                  <p className="text-label text-white/52">active queue</p>
                </div>
                <div>
                  <p className="font-data text-headline text-white">{completionRate}%</p>
                  <p className="text-label text-white/52">completion</p>
                </div>
              </div>
              <div className="mt-4 h-px bg-white/10" />
              <p className="mt-3 text-label text-white/52">
                Monitoring order masuk, dispatch admin, dan ledger pendapatan.
              </p>
            </div>
          </div>

          <MetricStrip
            metrics={[
              {
                label: "Queue depth",
                value: queueDepth,
                helper: "Waiting Action + In Process",
              },
              {
                label: "Completion",
                value: `${completionRate}%`,
                helper: `${stats.done} dari ${stats.totalOrders} order`,
              },
              {
                label: "Revenue",
                value: formatRupiah(stats.revenueToday),
                helper: "Pendapatan hari ini",
              },
            ]}
          />
        </div>

        <aside className="rounded-card border border-hairline bg-surface p-5 shadow-resting">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-label text-ink-soft">Antrean aktif</p>
                <p className="mt-1 text-headline text-ink">
                  {queueDepth} order aktif
                </p>
              </div>
              <span className="grid size-10 place-items-center rounded-lg border border-action/15 bg-action-wash text-action">
                <ClockCountdown className="size-6" weight="regular" />
              </span>
            </div>

            <div className="mt-4 divide-y divide-hairline border-y border-hairline">
              {liveOrders.map((order, index) => (
                <Link
                  key={order.id}
                  href={`/admin/orders/${order.orderId}`}
                  className="group flex items-center justify-between gap-3 py-3 transition-colors duration-150 hover:bg-action-wash/45"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="font-data text-label text-ink-faint">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="font-data text-body font-bold text-ink">
                        {order.orderId}
                      </p>
                      <p className="mt-0.5 truncate text-label text-ink-soft">
                        {order.user?.fullName ?? "User"} · {order.imei}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={order.status} />
                </Link>
              ))}
            </div>
            <Link
              href="/admin/orders"
              className="mt-4 inline-flex rounded-md text-label font-bold text-action hover:underline"
            >
              Lihat semua order
            </Link>
          </div>
        </aside>
      </section>

      <div className="space-y-6">
        <StatGrid>
          <StatTile
            index={0}
            tone="action"
            label="Total Order"
            value={stats.totalOrders}
            hint="Semua order di sistem, semua status."
            caption={`+${stats.ordersToday} dari hari ini`}
            href="/admin/orders"
          />
          <StatTile
            index={1}
            tone="working"
            label="Waiting Admin"
            value={stats.waitingAction}
            hint="Order berbayar yang menunggu diambil admin."
            caption="Menunggu diambil"
            href="/admin/orders"
          />
          <StatTile
            index={2}
            tone="sky"
            label="In Process"
            value={stats.inProcess}
            hint="Order yang sedang dikerjakan admin."
            caption="Sedang dikerjakan"
            href="/admin/orders"
          />
          <StatTile
            index={3}
            tone="cleared"
            label="Done"
            value={stats.done}
            hint="Order yang sudah selesai dikerjakan."
            caption="Selesai keseluruhan"
            href="/admin/orders"
          />
        </StatGrid>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
          {insights ? (
            <FinanceSummaryCard insights={insights} />
          ) : (
            <Card>
              <CardBody className="p-6 sm:p-7">
                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-end">
                  <div>
                    <p className="text-label text-ink-soft">Pendapatan hari ini</p>
                    <p className="mt-3 font-data text-display text-ink">
                      {formatRupiah(stats.revenueToday)}
                    </p>
                    <p className="mt-3 max-w-xl text-body text-ink-soft">
                      Nilai yang sudah tercatat dari order yang selesai diproses
                      dalam siklus operasional hari ini.
                    </p>
                  </div>
                  <div className="rounded-card border border-hairline bg-mist/40 p-4">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-lg border border-action/15 bg-action-wash text-action">
                        <CurrencyCircleDollar className="size-6" weight="regular" />
                      </span>
                      <div>
                        <p className="text-label text-ink-soft">Order hari ini</p>
                        <p className="font-data text-headline text-ink">
                          +{stats.ordersToday}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <SummaryTile
              label="User"
              value={stats.totalUsers}
              helper="Akun aktif yang dapat membuat order."
              icon={<Users className="size-5" weight="regular" />}
            />
            <SummaryTile
              label="Layanan aktif"
              value={stats.activeServices}
              helper="Layanan yang tersedia untuk user."
              icon={<Package className="size-5" weight="regular" />}
            />
          </div>
        </div>

        {insights ? <InsightSections insights={insights} /> : null}

        <Card className="shadow-lifted">
          <CardHeader>
            <CardTitle>Order terbaru</CardTitle>
            <Link
              href="/admin/orders"
              className="rounded-full border border-action/15 bg-action-wash px-3 py-1.5 text-label font-bold text-action transition-colors hover:bg-action hover:text-white"
            >
              Lihat semua
            </Link>
          </CardHeader>
          <div className="mt-4 border-t border-hairline">
            <TableScroll>
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Order ID</TH>
                    <TH>User</TH>
                    <TH>IMEI</TH>
                    <TH>Status</TH>
                    <TH>Dibuat</TH>
                  </TR>
                </THead>
                <TBody>
                  {stats.recentOrders.map((order) => (
                    <TR key={order.id}>
                      <TD>
                        <Link
                          href={`/admin/orders/${order.orderId}`}
                          className="font-data text-action hover:underline"
                        >
                          {order.orderId}
                        </Link>
                      </TD>
                      <TD>{order.user?.fullName ?? "-"}</TD>
                      <TD>
                        <DataValue>{order.imei}</DataValue>
                      </TD>
                      <TD>
                        <StatusBadge status={order.status} />
                      </TD>
                      <TD>
                        <DataValue className="text-ink-soft">
                          {formatDateTime(order.createdAt)}
                        </DataValue>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableScroll>
          </div>
        </Card>
      </div>
    </div>
  );
}
