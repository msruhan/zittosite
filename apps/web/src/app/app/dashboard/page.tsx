import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DataValue, TicketId } from "@/components/ui/data-value";
import { EmptyState } from "@/components/ui/empty-state";
import { Reveal } from "@/components/ui/reveal";
import { StatusBadge, Tag } from "@/components/ui/status-badge";
import { TicketStub } from "@/components/ui/ticket-stub";
import { DashboardMonthFilter } from "@/components/domain/dashboard-month-filter";
import { StatGrid, StatTile } from "@/components/domain/stat-tile";
import { TicketShowcase } from "@/components/domain/ticket-showcase";
import { UserOrderTable } from "@/components/domain/user-order-table";
import { ORDER_STATUS } from "@/lib/status";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import { formatDateTime, formatRupiah, maskImei } from "@/lib/format";
import type { OrderDetail, User } from "@/lib/types";

export const metadata: Metadata = {
  title: "Dashboard",
};

const ACTIVE = new Set([
  "waiting_payment",
  "paid",
  "waiting_action",
  "in_process",
]);

function toMonthKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

function buildMonthOptions(orders: OrderDetail[]) {
  const now = new Date();
  const keys = new Set<string>();

  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.add(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  for (const order of orders) {
    keys.add(toMonthKey(order.createdAt));
  }

  const sorted = [...keys].sort((a, b) => b.localeCompare(a));
  return [
    { value: "all", label: "Semua waktu" },
    ...sorted.map((value) => ({
      value,
      label: formatMonthLabel(value),
    })),
  ];
}

export default async function UserDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string }>;
}) {
  const params = await searchParams;
  const bulan = params.bulan && /^\d{4}-\d{2}$/.test(params.bulan)
    ? params.bulan
    : "all";

  let user: User;
  let orders: OrderDetail[] = [];
  try {
    user = await serverApi<User>("/me");
    orders = await serverApi<OrderDetail[]>("/orders");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  const monthOptions = buildMonthOptions(orders);
  const filtered =
    bulan === "all"
      ? orders
      : orders.filter((order) => toMonthKey(order.createdAt) === bulan);

  const periodLabel =
    bulan === "all" ? "Semua waktu" : formatMonthLabel(bulan);

  const stats = {
    totalOrders: filtered.length,
    activeOrders: filtered.filter((o) => ACTIVE.has(o.status)).length,
    doneOrders: filtered.filter((o) => o.status === "done").length,
    balance: user.creditBalance ?? 0,
  };
  const latest = filtered[0] ?? null;
  const recent = filtered.slice(0, 5);
  const firstName = user.fullName.split(" ")[0] ?? user.fullName;

  return (
    <div className="space-y-5 sm:space-y-6">
      <Reveal>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-display text-ink">Halo, {firstName}</h1>
            <p className="mt-1.5 text-body text-ink-soft">
              Selamat datang kembali di ZittoSite. Pantau tiket Anda di bawah.
            </p>
          </div>
          <Suspense fallback={null}>
            <DashboardMonthFilter value={bulan} options={monthOptions} />
          </Suspense>
        </div>
      </Reveal>

      <StatGrid>
        <StatTile
          index={0}
          tone="action"
          label="Total Order"
          value={stats.totalOrders}
          hint="Order pada periode yang dipilih."
          caption={periodLabel}
          href="/app/riwayat"
        />
        <StatTile
          index={1}
          tone="working"
          label="Order Aktif"
          value={stats.activeOrders}
          hint="Order yang belum selesai pada periode ini."
          caption="Sedang berjalan"
          href="/app/riwayat"
        />
        <StatTile
          index={2}
          tone="cleared"
          label="Selesai"
          value={stats.doneOrders}
          hint="Order Done pada periode ini."
          caption="Status Done"
          href="/app/riwayat"
        />
        <StatTile
          index={3}
          tone="sky"
          label="Saldo"
          value={formatRupiah(stats.balance)}
          hint="Saldo kredit akun — tidak berubah oleh filter bulan."
          caption={stats.balance === 0 ? "Tidak ada saldo" : "Siap dipakai"}
          href="/app/profil"
        />
      </StatGrid>

      <Reveal delay={60}>
        <TicketShowcase
          body="Pilih layanan, bayar, lalu pantau statusnya di sini sampai selesai. Nomor tiket Anda tidak berubah."
        />
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Reveal delay={80} as="article">
          <Card className="overflow-hidden">
            <CardHeader>
              <div>
                <p className="text-label uppercase text-ink-soft">Tiket aktif</p>
                <CardTitle className="mt-1">Order terakhir</CardTitle>
              </div>
              {latest ? <StatusBadge status={latest.status} stampIn /> : null}
            </CardHeader>

            {latest ? (
              <>
                <CardBody className="pt-3">
                  <TicketId>{latest.orderId}</TicketId>
                  <p className="mt-1 text-body text-ink-soft">
                    {ORDER_STATUS[latest.status].meaning}
                  </p>

                  <dl className="mt-4 divide-y divide-hairline border-t border-hairline">
                    <div className="flex items-baseline justify-between gap-4 py-2.5">
                      <dt className="text-body text-ink-soft">Layanan</dt>
                      <dd className="text-body font-medium text-ink">
                        {latest.service.name}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4 py-2.5">
                      <dt className="text-body text-ink-soft">IMEI</dt>
                      <dd>
                        <DataValue>{maskImei(latest.imei)}</DataValue>
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4 py-2.5">
                      <dt className="text-body text-ink-soft">Dibuat</dt>
                      <dd>
                        <DataValue className="text-ink-soft">
                          {formatDateTime(latest.createdAt)}
                        </DataValue>
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4 py-2.5">
                      <dt className="text-body text-ink-soft">Dibuat dari</dt>
                      <dd>
                        <Tag>
                          {latest.channel === "telegram"
                            ? "Telegram"
                            : "Website"}
                        </Tag>
                      </dd>
                    </div>
                  </dl>
                </CardBody>

                <div className="border-t border-hairline px-5 py-4 sm:px-7">
                  <Button asChild variant="outline" block>
                    <Link href={`/app/order/${latest.orderId}`}>
                      Lihat detail
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
                <TicketStub />
              </>
            ) : (
              <EmptyState
                icon={<Package strokeWidth={1.5} />}
                title="Tidak ada order di periode ini"
                description={`Belum ada order untuk ${periodLabel.toLowerCase()}. Coba bulan lain atau buat order baru.`}
                action={
                  <Button asChild>
                    <Link href="/app/order">Buat order</Link>
                  </Button>
                }
              />
            )}
          </Card>
        </Reveal>

        <Reveal delay={120} as="section">
          <Card className="flex h-full flex-col justify-between">
            <CardBody className="flex flex-1 flex-col justify-between gap-5 pt-5">
              <div>
                <p className="text-label uppercase text-ink-soft">Mulai sekarang</p>
                <CardTitle className="mt-1.5">Buat order baru</CardTitle>
                <p className="mt-2 max-w-[36ch] text-body text-ink-soft">
                  Pilih layanan, masukkan IMEI, dan bayar lewat QRIS. Nomor tiket
                  terbit langsung setelah order dibuat.
                </p>
              </div>
              <Button asChild>
                <Link href="/app/order">
                  Order sekarang
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </CardBody>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={160}>
        <Card>
          <CardHeader>
            <CardTitle>Riwayat order terbaru</CardTitle>
            <Link
              href="/app/riwayat"
              className="text-body font-medium text-action underline-offset-4 transition-colors hover:text-action-pressed hover:underline"
            >
              Lihat semua
            </Link>
          </CardHeader>
          <div className="mt-4 border-t border-hairline">
            {recent.length > 0 ? (
              <UserOrderTable orders={recent} />
            ) : (
              <EmptyState
                icon={<Package strokeWidth={1.5} />}
                title="Riwayat kosong untuk periode ini"
                description={`Tidak ada order pada ${periodLabel.toLowerCase()}.`}
                action={
                  <Button asChild>
                    <Link href="/app/order">Buat order</Link>
                  </Button>
                }
              />
            )}
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
