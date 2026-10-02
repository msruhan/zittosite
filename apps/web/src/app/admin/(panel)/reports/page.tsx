import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowDownRight, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/shell/app-shell";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DataValue } from "@/components/ui/data-value";
import { Tag } from "@/components/ui/status-badge";
import {
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableScroll,
} from "@/components/ui/table";
import { DonutChart } from "@/components/domain/donut-chart";
import { OrdersBarChart } from "@/components/domain/orders-bar-chart";
import { ReportPeriodFilter } from "@/components/domain/report-period-filter";
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

type Money = {
  revenue: number;
  /** Null for admins who are not Super Admin. */
  cost: number | null;
  profit: number | null;
  orders: number;
};

type AllTimeReport = {
  period: null;
  finance: {
    canSeeCost: boolean;
    today: Money;
    month: Money;
    prevMonth: Money;
    allTime: Money;
  };
  kpis: {
    revenueTotal: number;
    revenueToday: number;
    ordersToday: number;
    usersTotal: number;
    usersActive: number;
    ordersDone: number;
    waitingAction: number;
  };
};

/** Filtered by year (breakdown per month) or month (per week, charts per day). */
type PeriodReport = {
  period: { year: number; month: number | null; label: string };
  finance: {
    canSeeCost: boolean;
    period: Money;
    breakdown: { label: string; money: Money }[];
  };
  kpis: {
    ordersCreated: number;
    usersTotal: number;
    usersActive: number;
    ordersDone: number;
    waitingAction: number;
  };
};

type ReportsSummary = (AllTimeReport | PeriodReport) & {
  years: number[];
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

function marginPct(money: Money): number {
  return money.revenue > 0 && money.profit !== null
    ? Math.round((money.profit / money.revenue) * 100)
    : 0;
}

type FinanceRow = { label: string; money: Money; total?: boolean };

function financeRows(data: ReportsSummary): FinanceRow[] {
  if (data.period) {
    return [
      ...data.finance.breakdown,
      { label: `Total ${data.period.label}`, money: data.finance.period, total: true },
    ];
  }
  return [
    { label: "Hari ini", money: data.finance.today },
    { label: "Bulan ini", money: data.finance.month },
    { label: "Bulan lalu", money: data.finance.prevMonth },
    { label: "Semua waktu", money: data.finance.allTime, total: true },
  ];
}

function FinanceTable({
  rows,
  showCost,
  periodLabel,
}: {
  rows: FinanceRow[];
  showCost: boolean;
  periodLabel: string | null;
}) {
  return (
    <Card>
      <CardHeader className="items-start">
        <div className="min-w-0">
          <CardTitle>Rincian keuangan</CardTitle>
          <p className="mt-1 text-body text-ink-soft">
            {showCost
              ? "Omset = total harga jual · Modal = biaya ke operator/Supplier API · Keuntungan = omset − modal."
              : "Omset = total harga jual dari order yang selesai."}
          </p>
        </div>
        <Tag>{periodLabel ? `${periodLabel} · WIB` : "WIB"}</Tag>
      </CardHeader>
      <TableScroll>
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Periode</TH>
              <TH className="text-right">Order sukses</TH>
              <TH className="text-right">Omset</TH>
              {showCost ? (
                <>
                  <TH className="text-right">Modal</TH>
                  <TH className="text-right">Keuntungan</TH>
                  <TH className="text-right">Margin</TH>
                </>
              ) : null}
            </TR>
          </THead>
          <TBody>
            {rows.map(({ label, money, total }) => (
              <TR key={label} className={total ? "bg-mist/50" : undefined}>
                <TD className="font-medium text-ink">{label}</TD>
                <TD className="text-right">
                  <DataValue>{money.orders}</DataValue>
                </TD>
                <TD className="text-right">
                  <DataValue emphasis>{formatRupiah(money.revenue)}</DataValue>
                </TD>
                {showCost ? (
                  <>
                    <TD className="text-right">
                      <DataValue className="text-ink-soft">
                        {formatRupiah(money.cost ?? 0)}
                      </DataValue>
                    </TD>
                    <TD className="text-right">
                      <DataValue
                        emphasis
                        className={(money.profit ?? 0) < 0 ? "text-refused-ink" : "text-cleared-ink"}
                      >
                        {formatRupiah(money.profit ?? 0)}
                      </DataValue>
                    </TD>
                    <TD className="text-right">
                      <DataValue className="text-ink-soft">{marginPct(money)}%</DataValue>
                    </TD>
                  </>
                ) : null}
              </TR>
            ))}
          </TBody>
        </Table>
      </TableScroll>
    </Card>
  );
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tahun?: string | string[]; bulan?: string | string[] }>;
}) {
  const params = await searchParams;
  const tahun = firstParam(params.tahun);
  const bulan = firstParam(params.bulan);
  const query = new URLSearchParams();
  if (tahun) query.set("tahun", tahun);
  if (tahun && bulan) query.set("bulan", bulan);
  const qs = query.toString();

  let data: ReportsSummary;
  try {
    data = await serverApi<ReportsSummary>(
      qs ? `/admin/reports/summary?${qs}` : "/admin/reports/summary",
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect("/admin/login");
    }
    throw err;
  }

  const { kpis, weeklyBars, finance, period } = data;
  const canSeeCost = finance.canSeeCost;
  const headline = period ? data.finance.period : data.finance.allTime;
  const today = period ? null : data.finance.today;
  const periodLabel = period?.label ?? null;
  const chartScope = period
    ? period.month
      ? `per hari · ${period.label}`
      : `per bulan · ${period.label}`
    : "7 hari terakhir";

  const barTotal = weeklyBars.reduce((sum, day) => sum + day.orders, 0);
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
        description={
          periodLabel
            ? `Omset, modal, keuntungan, dan volume order periode ${periodLabel}.`
            : "Omset, modal, keuntungan, distribusi kanal, dan volume order mingguan."
        }
        actions={
          <Suspense fallback={null}>
            <ReportPeriodFilter
              years={data.years}
              year={period?.year ?? null}
              month={period?.month ?? null}
            />
          </Suspense>
        }
      />

      <div className="space-y-5 sm:space-y-6">
        <StatGrid>
          <StatTile
            index={0}
            tone="cleared"
            label={period ? "Omset" : "Total omset"}
            value={formatRupiah(headline.revenue)}
            hint="Total harga jual dari order Done. Order gagal atau di-refund tidak dihitung."
            caption={
              today
                ? `Hari ini ${formatRupiah(today.revenue)}`
                : `${periodLabel} · ${headline.orders} order sukses`
            }
            href="/admin/orders"
          />
          {canSeeCost ? (
            <>
              <StatTile
                index={1}
                tone="hold"
                label={period ? "Modal" : "Total modal"}
                value={formatRupiah(headline.cost ?? 0)}
                hint="Total harga modal yang dibayar ke operator atau Supplier API untuk order tersebut."
                caption={today ? `Hari ini ${formatRupiah(today.cost ?? 0)}` : periodLabel ?? undefined}
                href="/admin/services"
              />
              <StatTile
                index={2}
                tone="action"
                label={period ? "Keuntungan" : "Total keuntungan"}
                value={formatRupiah(headline.profit ?? 0)}
                hint="Omset dikurangi modal."
                caption={
                  today
                    ? `Margin ${marginPct(headline)}% · hari ini ${formatRupiah(today.profit ?? 0)}`
                    : `Margin ${marginPct(headline)}% · ${periodLabel}`
                }
                href="/admin/orders"
              />
            </>
          ) : (
            <StatTile
              index={1}
              tone="sky"
              label="User terdaftar"
              value={kpis.usersTotal}
              hint="Akun user yang dibuat Super Admin."
              caption={`${kpis.usersActive} aktif`}
              href="/admin/users"
            />
          )}
          <StatTile
            index={3}
            tone="working"
            label="Order selesai"
            value={kpis.ordersDone}
            hint={period ? "Order Done yang selesai dalam periode ini." : "Order berstatus Done."}
            caption={
              period
                ? `${data.kpis.ordersCreated} order masuk · ${kpis.waitingAction} menunggu aksi`
                : canSeeCost
                  ? `${kpis.waitingAction} menunggu aksi · ${kpis.usersTotal} user`
                  : `${kpis.waitingAction} menunggu aksi`
            }
            href="/admin/orders"
          />
        </StatGrid>

        <FinanceTable rows={financeRows(data)} showCost={canSeeCost} periodLabel={periodLabel} />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Kanal order</CardTitle>
              <Tag>{periodLabel ?? "7 hari"}</Tag>
            </CardHeader>
            <CardBody className="pt-2">
              {data.channelMix.length > 0 ? (
                <DonutChart data={data.channelMix} centerLabel="Order" />
              ) : (
                <p className="py-10 text-center text-body text-ink-soft">
                  {periodLabel
                    ? `Belum ada order di ${periodLabel}.`
                    : "Belum ada order 7 hari terakhir."}
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="items-start">
              <div className="min-w-0">
                <CardTitle>Volume order</CardTitle>
                <p className="mt-1 text-body font-medium text-ink-soft">
                  Order masuk {chartScope}
                </p>
              </div>
              <div className="text-right">
                <p className="font-data tabular text-metric font-bold text-ink">
                  {formatCompactNumber(barTotal)}
                </p>
                {period ? (
                  <p className="mt-0.5 text-body font-medium text-ink-soft">total order</p>
                ) : (
                  <p
                    className={cn(
                      "mt-0.5 inline-flex items-center gap-1 text-body font-medium",
                      trendUp ? "text-cleared-ink" : "text-refused-ink",
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
                )}
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
              <CardTitle>{period ? "Omset" : "Omset 7 hari"}</CardTitle>
              <Tag>{period ? chartScope : "Area"}</Tag>
            </CardHeader>
            <CardBody className="pt-2">
              <RevenueChart data={data.revenueSeries} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bauran layanan</CardTitle>
              <Tag>{periodLabel ?? "Donut"}</Tag>
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
