import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DetailRow,
} from "@/components/ui/card";
import { DataValue, TicketId } from "@/components/ui/data-value";
import {
  ResultBadge,
  StatusBadge,
  Tag,
} from "@/components/ui/status-badge";
import { OrderStepper } from "@/components/domain/order-stepper";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import { formatDateTime, formatRupiah, maskImei } from "@/lib/format";
import type { OrderDetail } from "@/lib/types";

export const metadata: Metadata = {
  title: "Detail Order",
};

export default async function OrderDetailPage({
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

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <Link
        href="/app/riwayat"
        className="inline-flex items-center gap-1.5 text-body font-medium text-ink-soft underline-offset-4 transition-colors duration-150 ease-out-strong hover:text-ink hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Riwayat order
      </Link>

      <Card>
        <CardHeader>
          <div>
            <p className="text-label uppercase text-ink-soft">Order ID</p>
            <TicketId className="mt-1 block">{order.orderId}</TicketId>
          </div>
          <StatusBadge status={order.status} />
        </CardHeader>

        <CardBody className="pt-3">
          <dl className="divide-y divide-hairline">
            <DetailRow label="Layanan">{order.service.name}</DetailRow>
            <DetailRow label="IMEI">
              <DataValue>{maskImei(order.imei)}</DataValue>
            </DetailRow>
            <DetailRow label="Harga">
              <DataValue emphasis>{formatRupiah(order.price)}</DataValue>
            </DetailRow>
            <DetailRow label="Dibuat dari">
              <Tag>
                {order.channel === "telegram" ? "Telegram" : "Website"}
              </Tag>
            </DetailRow>
            <DetailRow label="Dibuat">
              <DataValue className="text-ink-soft">
                {formatDateTime(order.createdAt)}
              </DataValue>
            </DetailRow>
            {order.startedAt ? (
              <DetailRow label="Dimulai">
                <DataValue className="text-ink-soft">
                  {formatDateTime(order.startedAt)}
                </DataValue>
              </DetailRow>
            ) : null}
            {order.completedAt ? (
              <DetailRow label="Selesai">
                <DataValue className="text-ink-soft">
                  {formatDateTime(order.completedAt)}
                </DataValue>
              </DetailRow>
            ) : null}
            {order.assignedAdmin ? (
              <DetailRow label="Admin pemroses">
                {order.assignedAdmin.fullName}
              </DetailRow>
            ) : null}
            {order.notes ? (
              <DetailRow label="Catatan Anda">{order.notes}</DetailRow>
            ) : null}
          </dl>
        </CardBody>

        {order.status === "waiting_payment" ? (
          <div className="border-t border-hairline px-4 py-3 sm:px-5">
            <Button asChild block>
              <Link href={`/app/order/${order.orderId}/bayar`}>
                Selesaikan pembayaran
              </Link>
            </Button>
          </div>
        ) : null}
      </Card>

      {order.result ? (
        <Card>
          <CardHeader>
            <CardTitle>Hasil order</CardTitle>
            <ResultBadge status={order.result.resultStatus} />
          </CardHeader>
          <CardBody className="pt-3">
            <p className="text-body text-ink">{order.result.resultNote}</p>
            {order.result.resultData ? (
              <dl className="mt-4 divide-y divide-hairline border-t border-hairline">
                {Object.entries(order.result.resultData).map(([key, value]) => (
                  <DetailRow key={key} label={key}>
                    {value}
                  </DetailRow>
                ))}
              </dl>
            ) : null}
            <p className="mt-4 font-data tabular text-body text-ink-soft">
              Dikirim {formatDateTime(order.result.createdAt)}
            </p>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Perjalanan order</CardTitle>
          <Link
            href={`/app/order/${order.orderId}/status`}
            className="text-body font-medium text-action underline-offset-4 hover:underline"
          >
            Buka status penuh
          </Link>
        </CardHeader>
        <CardBody className="pt-3">
          <OrderStepper order={order} />
        </CardBody>
      </Card>
    </div>
  );
}
