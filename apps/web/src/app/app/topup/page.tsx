import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DataValue } from "@/components/ui/data-value";
import { PaymentBadge } from "@/components/ui/status-badge";
import { TopupForm } from "@/components/domain/topup-form";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import { formatDateTime, formatRupiah } from "@/lib/format";
import type { Topup, User } from "@/lib/types";

export const metadata: Metadata = {
  title: "Topup Saldo",
};

export default async function TopupPage() {
  let user: User;
  let topups: { pending: Topup | null; history: Topup[] };
  try {
    [user, topups] = await Promise.all([
      serverApi<User>("/me"),
      serverApi<{ pending: Topup | null; history: Topup[] }>("/topups"),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }
  const { pending, history } = topups;

  return (
    <>
      <PageHeader
        title="Topup Saldo"
        description="Isi saldo dengan QRIS. Saldo masuk otomatis setelah pembayaran terdeteksi dan langsung dipakai saat Anda membuat order."
      />

      <div className="mx-auto w-full max-w-xl space-y-4">
        <Card>
          <CardBody>
            <p className="text-label uppercase text-ink-soft">Saldo sekarang</p>
            <DataValue emphasis className="mt-1 block text-display">
              {formatRupiah(user.creditBalance ?? 0)}
            </DataValue>
          </CardBody>
        </Card>

        {pending ? (
          <Card>
            <CardBody className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-body font-medium text-ink">
                    Topup {formatRupiah(pending.amount)} menunggu pembayaran
                  </p>
                  <p className="font-data text-body text-ink-soft">
                    {pending.invoiceId}
                  </p>
                </div>
                <PaymentBadge status="pending" />
              </div>
              <Button asChild block>
                <Link href={`/app/topup/${pending.invoiceId}`}>
                  Lanjutkan pembayaran
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Topup baru</CardTitle>
            </CardHeader>
            <CardBody className="pt-3">
              <TopupForm />
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Riwayat topup</CardTitle>
          </CardHeader>
          <CardBody className="pt-3">
            {history.length ? (
              <ul className="divide-y divide-hairline border-t border-hairline">
                {history.map((topup) => (
                  <li
                    key={topup.invoiceId}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <DataValue emphasis>{formatRupiah(topup.amount)}</DataValue>
                      <p className="font-data text-body text-ink-soft">
                        {topup.invoiceId} · {formatDateTime(topup.paidAt ?? topup.createdAt)}
                      </p>
                    </div>
                    <PaymentBadge status={topup.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body text-ink-soft">Belum ada topup.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
