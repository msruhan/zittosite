import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { DataValue, TicketId } from "@/components/ui/data-value";
import { PaymentPanel } from "@/components/domain/payment-panel";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import { formatDateTime, maskImei } from "@/lib/format";
import type { OrderDetail } from "@/lib/types";

export const metadata: Metadata = {
  title: "Pembayaran",
};

function qrisPayload(orderId: string, amount: number): string {
  return `ZITTOSITE|QRIS-PLACEHOLDER|${orderId}|${amount}`;
}

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  let order: OrderDetail;
  try {
    order = await serverApi<OrderDetail>(`/orders/${orderId}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  if (order.status !== "waiting_payment") {
    redirect(`/app/order/${order.orderId}`);
  }
  if (!order.invoice) notFound();

  return (
    <div className="mx-auto w-full max-w-xl">
      <Link
        href={`/app/order/${order.orderId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-body font-medium text-ink-soft underline-offset-4 transition-colors duration-150 ease-out-strong hover:text-ink hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Kembali ke order
      </Link>

      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle>Selesaikan pembayaran</CardTitle>
          <TicketId className="text-body">{order.orderId}</TicketId>
        </CardHeader>

        <dl className="mt-4 divide-y divide-hairline border-y border-hairline px-4 sm:px-5">
          <div className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-body text-ink-soft">Layanan</dt>
            <dd className="text-body font-medium text-ink">
              {order.service.name}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-body text-ink-soft">IMEI</dt>
            <dd>
              <DataValue>{maskImei(order.imei)}</DataValue>
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-body text-ink-soft">Invoice</dt>
            <dd>
              <DataValue className="text-ink-soft">
                {order.invoice.invoiceId}
              </DataValue>
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-body text-ink-soft">Dibuat</dt>
            <dd>
              <DataValue className="text-ink-soft">
                {formatDateTime(order.createdAt)}
              </DataValue>
            </dd>
          </div>
        </dl>

        <PaymentPanel
          orderId={order.orderId}
          amount={order.invoice.amount}
          expiresAt={order.invoice.expiredAt}
          qrPayload={qrisPayload(order.orderId, order.invoice.amount)}
        />
      </Card>
    </div>
  );
}
