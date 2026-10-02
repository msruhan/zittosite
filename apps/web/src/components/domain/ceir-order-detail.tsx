import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, DetailRow } from "@/components/ui/card";
import { DataValue, TicketId } from "@/components/ui/data-value";
import { StatusBadge } from "@/components/ui/status-badge";
import { CancelOrderButton } from "@/components/domain/cancel-order-button";
import { CeirResultView } from "@/components/domain/ceir-result-view";
import { parseCeirResult } from "@/lib/ceir-result";
import { deviceLabel, orderExtraRows } from "@/lib/order-fields";
import { formatDateTime, formatRupiah } from "@/lib/format";
import type { OrderDetail } from "@/lib/types";

/** Supplier results arrive as "Result: UNKNOWN"; only the value is shown. */
function resultText(order: OrderDetail): string | null {
  if (order.result?.resultNote) {
    return order.result.resultNote.replace(/^\s*result\s*:\s*/i, "").trim();
  }
  if (order.status === "rejected") return order.statusReason || "Ditolak";
  if (order.status === "waiting_payment") return null;
  return "Menunggu hasil…";
}

/** Order Ceir detail: one card with the essentials, no admin journey. */
export function CeirOrderDetail({ order }: { order: OrderDetail }) {
  const result = resultText(order);
  return (
    <Card>
      <CardHeader>
        <div>
          <p className="text-label uppercase text-ink-soft">Order ID</p>
          <TicketId className="mt-1 block">{order.orderId}</TicketId>
        </div>
        <StatusBadge status={order.status} via={order.service.via} />
      </CardHeader>

      <CardBody className="pt-3">
        <dl className="divide-y divide-hairline">
          <DetailRow label="Layanan">{order.service.name}</DetailRow>
          {deviceLabel(order.service.inputType) ? (
            <DetailRow label={deviceLabel(order.service.inputType)!}>
              <DataValue>{order.imei}</DataValue>
            </DetailRow>
          ) : null}
          {orderExtraRows(order).map((row) => (
            <DetailRow key={row.label} label={row.label}>
              <DataValue className="break-all">{row.value}</DataValue>
            </DetailRow>
          ))}
          <DetailRow label="Harga">
            <DataValue>{formatRupiah(order.price)}</DataValue>
          </DetailRow>
          <DetailRow label="Tanggal">
            <DataValue className="text-ink-soft">
              {formatDateTime(order.completedAt ?? order.createdAt)}
            </DataValue>
          </DetailRow>
        </dl>

        {order.result && parseCeirResult(order.result.resultNote) ? (
          <CeirResultView text={order.result.resultNote} className="mt-4" />
        ) : result ? (
          <div className="mt-4 flex items-baseline justify-between gap-4 rounded-md border border-hairline bg-mist px-4 py-3">
            <span className="text-body text-ink-soft">Hasil</span>
            <DataValue emphasis className="whitespace-pre-line text-right">
              {result}
            </DataValue>
          </div>
        ) : null}
      </CardBody>

      {order.status === "waiting_payment" ? (
        <div className="space-y-2 border-t border-hairline px-4 py-3 sm:px-5">
          <Button asChild block>
            <Link href={`/app/order/${order.orderId}/bayar`}>Selesaikan pembayaran</Link>
          </Button>
          <CancelOrderButton
            orderId={order.orderId}
            bulkCount={
              order.invoice?.orders?.filter((o) => o.status === "waiting_payment").length
            }
          />
        </div>
      ) : null}
    </Card>
  );
}
