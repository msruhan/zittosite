import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { DataValue, TicketId } from "@/components/ui/data-value";
import { PaymentPanel } from "@/components/domain/payment-panel";
import { CancelOrderButton } from "@/components/domain/cancel-order-button";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import { orderMenu } from "@/lib/order-routes";
import { formatDateTime, formatRupiah } from "@/lib/format";
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

  if (order.status === "cancel") {
    redirect(`/app/order/${order.orderId}`);
  }
  const menu = orderMenu(order.service);
  if (order.status !== "waiting_payment") {
    redirect(menu.listHref);
  }
  if (!order.invoice) notFound();
  const bulk = order.invoice.orders ?? [];
  const isBulk = bulk.length > 1;

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
          {isBulk ? (
            <>
              <div className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="text-body text-ink-soft">Jumlah</dt>
                <dd>
                  <DataValue>
                    {bulk.length} × {formatRupiah(order.price)}
                  </DataValue>
                </dd>
              </div>
              <div className="py-2.5">
                <dt className="text-body text-ink-soft">
                  IMEI ({bulk.length} order, 1 QRIS)
                </dt>
                <dd className="mt-2">
                  <ul className="space-y-1.5">
                    {bulk.map((item) => (
                      <li
                        key={item.orderId}
                        className="flex items-baseline justify-between gap-4"
                      >
                        <DataValue className="text-ink-soft">
                          {item.orderId}
                        </DataValue>
                        <DataValue>{item.imei}</DataValue>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            </>
          ) : (
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-body text-ink-soft">IMEI</dt>
              <dd>
                <DataValue>{order.imei}</DataValue>
              </dd>
            </div>
          )}
          {order.invoice.balanceUsed ? (
            <>
              <div className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="text-body text-ink-soft">Total</dt>
                <dd>
                  <DataValue>{formatRupiah(order.invoice.amount)}</DataValue>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="text-body text-ink-soft">Dipotong saldo</dt>
                <dd>
                  <DataValue className="text-cleared-ink">
                    −{formatRupiah(order.invoice.balanceUsed)}
                  </DataValue>
                </dd>
              </div>
            </>
          ) : null}
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
          amount={order.invoice.amountDue ?? order.invoice.amount}
          expiresAt={order.invoice.expiredAt}
          qrPayload={
            order.invoice.qrisString ??
            (order.invoice.checkoutUrl
              ? null
              : qrisPayload(
                  order.orderId,
                  order.invoice.amountDue ?? order.invoice.amount,
                ))
          }
          checkoutUrl={order.invoice.checkoutUrl ?? null}
          gateway={order.invoice.paymentChannel === "sayabayar"}
          menu={menu}
          automated={order.service.via === "supplier"}
        />
        <div className="border-t border-hairline px-4 py-3 sm:px-5">
          <CancelOrderButton
            orderId={order.orderId}
            bulkCount={bulk.filter((o) => o.status === "waiting_payment").length}
          />
        </div>
      </Card>
    </div>
  );
}
