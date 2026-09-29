import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ClockCountdown,
  CurrencyCircleDollar,
  Package,
  Users,
} from "@phosphor-icons/react/dist/ssr";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DataValue } from "@/components/ui/data-value";
import { StatusBadge } from "@/components/ui/status-badge";
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

export default async function AdminDashboardPage() {
  let stats: DashboardStats;
  try {
    stats = await serverApi<DashboardStats>("/admin/dashboard/stats");
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
