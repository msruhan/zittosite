import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DataValue } from "@/components/ui/data-value";
import { Tag } from "@/components/ui/status-badge";
import { DonutChart } from "@/components/domain/donut-chart";
import { OrdersBarChart } from "@/components/domain/orders-bar-chart";
import { RevenueChart } from "@/components/domain/revenue-chart";
import { StatGrid, StatTile } from "@/components/domain/stat-tile";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import { formatCompactNumber, formatRupiah } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/status";
import type { OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Reports",
};

type ReportsSummary = {
  kpis: {
    revenueTotal: number;
    revenueToday: number;
    ordersToday: number;
    usersTotal: number;
    usersActive: number;
    ordersDone: number;
    waitingAction: number;
  };
  channelMix: { name: string; amount: number; color: string }[];
  weeklyBars: { label: string; orders: number }[];
  revenueSeries: { label: string; revenue: number; orders: number }[];
  serviceMix: { name: string; amount: number; color: string }[];
  byStatus: { status: OrderStatus; count: number }[];
  adminPerformance: {
    id: string;
    fullName: string;
    telegramHandle: string | null;
    handledCount: number;
  }[];
  services: {
    id: string;
    name: string;
    active: boolean;
    estimate: string;
    price: number;
  }[];
};

export default async function AdminReportsPage() {
  let data: ReportsSummary;
  try {
    data = await serverApi<ReportsSummary>("/admin/reports/summary");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect("/admin/login");
    }
    throw err;
  }

  const { kpis, weeklyBars } = data;
  const weekTotal = weeklyBars.reduce((sum, day) => sum + day.orders, 0);
  const prevHalf = weeklyBars
    .slice(0, 3)
    .reduce((sum, day) => sum + day.orders, 0);
  const nextHalf = weeklyBars
    .slice(4)
    .reduce((sum, day) => sum + day.orders, 0);
  const weekTrend =
    prevHalf === 0
      ? 0
      : Math.round(((nextHalf - prevHalf) / Math.max(prevHalf, 1)) * 1000) / 10;
  const trendUp = weekTrend >= 0;

  return (
    <>
      <PageHeader
        title="Reports"
        description="Ringkasan transaksi, distribusi kanal, dan volume order mingguan."
      />

      <div className="space-y-5 sm:space-y-6">
        <StatGrid>
          <StatTile
            index={0}
            tone="cleared"
            label="Pendapatan total"
            value={formatRupiah(kpis.revenueTotal)}
            hint="Total dari invoice berstatus paid."
            caption="Semua pembayaran diterima"
            href="/admin/orders"
          />
          <StatTile
            index={1}
            tone="action"
            label="Pendapatan hari ini"
            value={formatRupiah(kpis.revenueToday)}
            hint="Invoice paid hari ini (WIB)."
            caption={`+${kpis.ordersToday} order hari ini`}
            href="/admin/orders"
          />
          <StatTile
            index={2}
            tone="sky"
            label="User terdaftar"
            value={kpis.usersTotal}
            hint="Akun user yang dibuat Super Admin."
            caption={`${kpis.usersActive} aktif`}
            href="/admin/users"
          />
          <StatTile
            index={3}
            tone="working"
            label="Order selesai"
            value={kpis.ordersDone}
            hint="Order berstatus Done."
            caption={`${kpis.waitingAction} menunggu aksi`}
            href="/admin/orders"
          />
        </StatGrid>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Kanal order</CardTitle>
              <Tag>7 hari</Tag>
            </CardHeader>
            <CardBody className="pt-2">
              {data.channelMix.length > 0 ? (
                <DonutChart data={data.channelMix} centerLabel="Order" />
              ) : (
                <p className="py-10 text-center text-body text-ink-soft">
                  Belum ada order 7 hari terakhir.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="items-start">
              <div className="min-w-0">
                <CardTitle>Volume order</CardTitle>
                <p className="mt-1 text-body font-medium text-ink-soft">
                  Performa order 7 hari terakhir
                </p>
              </div>
              <div className="text-right">
                <p className="font-data tabular text-metric font-bold text-ink">
                  {formatCompactNumber(weekTotal)}
                </p>
                <p
                  className={cn(
                    "mt-0.5 inline-flex items-center gap-1 text-body font-medium",
                    trendUp ? "text-metric-green" : "text-metric-red",
                  )}
                >
                  {trendUp ? (
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  ) : (
                    <ArrowDownRight className="size-3.5" aria-hidden="true" />
                  )}
                  {trendUp ? "+" : ""}
                  {weekTrend}%
                </p>
              </div>
            </CardHeader>
            <CardBody className="pt-2">
              <OrdersBarChart data={weeklyBars} />
            </CardBody>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Pendapatan 7 hari</CardTitle>
              <Tag>Area</Tag>
            </CardHeader>
            <CardBody className="pt-2">
              <RevenueChart data={data.revenueSeries} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bauran layanan</CardTitle>
              <Tag>Donut</Tag>
            </CardHeader>
            <CardBody className="pt-2">
              {data.serviceMix.length > 0 ? (
                <DonutChart data={data.serviceMix} centerLabel="Order" />
              ) : (
                <p className="py-10 text-center text-body text-ink-soft">
                  Belum ada pembayaran.
                </p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Distribusi status</CardTitle>
            </CardHeader>
            <CardBody className="pt-3">
              <ul className="divide-y divide-hairline">
                {data.byStatus.map((row) => (
                  <li
                    key={row.status}
                    className="flex items-baseline justify-between gap-4 py-2.5"
                  >
                    <span className="text-body text-ink-soft">
                      {ORDER_STATUS[row.status].label}
                    </span>
                    <DataValue emphasis>{row.count}</DataValue>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kinerja admin</CardTitle>
            </CardHeader>
            <CardBody className="pt-3">
              {data.adminPerformance.length > 0 ? (
                <ul className="divide-y divide-hairline">
                  {data.adminPerformance.map((admin) => (
                    <li
                      key={admin.id}
                      className="flex items-baseline justify-between gap-4 py-2.5"
                    >
                      <div>
                        <p className="text-body font-medium text-ink">
                          {admin.fullName}
                        </p>
                        <p className="font-data text-body text-ink-soft">
                          {admin.telegramHandle ?? "Belum ditautkan"}
                        </p>
                      </div>
                      <DataValue emphasis>{admin.handledCount}</DataValue>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body text-ink-soft">Belum ada admin.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Layanan aktif</CardTitle>
            </CardHeader>
            <CardBody className="pt-3">
              <ul className="divide-y divide-hairline">
                {data.services.map((service) => (
                  <li
                    key={service.id}
                    className="flex items-baseline justify-between gap-4 py-2.5"
                  >
                    <div>
                      <p className="text-body font-medium text-ink">
                        {service.name}
                      </p>
                      <p className="text-body text-ink-soft">
                        {service.active ? "Aktif" : "Nonaktif"} ·{" "}
                        {service.estimate}
                      </p>
                    </div>
                    <DataValue emphasis>
                      {formatRupiah(service.price)}
                    </DataValue>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
