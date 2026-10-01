import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { DataValue, TicketId } from "@/components/ui/data-value";
import { PaymentPanel } from "@/components/domain/payment-panel";
import { CancelTopupButton } from "@/components/domain/cancel-topup-button";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import { formatDateTime, formatRupiah } from "@/lib/format";
import type { Topup } from "@/lib/types";

export const metadata: Metadata = {
  title: "Bayar Topup",
};

export default async function TopupPaymentPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  let topup: Topup;
  try {
    topup = await serverApi<Topup>(`/topups/${invoiceId}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  if (topup.status !== "pending") redirect("/app/topup");

  return (
    <div className="mx-auto w-full max-w-xl">
      <Link
        href="/app/topup"
        className="mb-4 inline-flex items-center gap-1.5 text-body font-medium text-ink-soft underline-offset-4 transition-colors duration-150 ease-out-strong hover:text-ink hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Kembali ke topup
      </Link>

      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle>Bayar topup saldo</CardTitle>
          <TicketId className="text-body">{topup.invoiceId}</TicketId>
        </CardHeader>

        <dl className="mt-4 divide-y divide-hairline border-y border-hairline px-4 sm:px-5">
          <div className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-body text-ink-soft">Saldo masuk</dt>
            <dd>
              <DataValue emphasis>{formatRupiah(topup.amount)}</DataValue>
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-body text-ink-soft">Dibuat</dt>
            <dd>
              <DataValue className="text-ink-soft">
                {formatDateTime(topup.createdAt)}
              </DataValue>
            </dd>
          </div>
        </dl>

        <PaymentPanel
          kind="topup"
          orderId={topup.invoiceId}
          amount={topup.amountDue}
          expiresAt={topup.expiredAt}
          qrPayload={
            topup.qrisString ??
            (topup.checkoutUrl
              ? null
              : `ZITTOSITE|QRIS-PLACEHOLDER|${topup.invoiceId}|${topup.amountDue}`)
          }
          checkoutUrl={topup.checkoutUrl}
          gateway={topup.paymentChannel === "sayabayar"}
        />
        <div className="border-t border-hairline px-4 py-3 sm:px-5">
          <CancelTopupButton invoiceId={topup.invoiceId} />
        </div>
      </Card>
    </div>
  );
}
