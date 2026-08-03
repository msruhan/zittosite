import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DetailRow,
} from "@/components/ui/card";
import { DataValue, TicketId } from "@/components/ui/data-value";
import {
  PaymentBadge,
  ResultBadge,
  StatusBadge,
  Tag,
} from "@/components/ui/status-badge";
import { OrderStepper } from "@/components/domain/order-stepper";
import { AdminOrderStatusOverride } from "@/components/domain/admin-order-status-override";
import { Avatar } from "@/components/shell/user-chip";
import { ORDER_STATUS } from "@/lib/status";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import { formatDateTime, formatRupiah } from "@/lib/format";
import type { OrderDetail } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orderId: string }>;
}): Promise<Metadata> {
  const { orderId } = await params;
  return { title: `Order ${orderId}` };
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  let order: OrderDetail;
  try {
    order = await serverApi<OrderDetail>(`/admin/orders/${orderId}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/admin/login");
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <>
      <Link
        href="/admin/orders"
        className="mb-4 inline-flex items-center gap-1.5 text-body font-medium text-ink-soft underline-offset-4 transition-colors duration-150 ease-out-strong hover:text-ink hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Semua order
      </Link>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <p className="text-label uppercase text-ink-soft">Order ID</p>
                <TicketId className="mt-1 block">{order.orderId}</TicketId>
              </div>
              <StatusBadge status={order.status} />
            </CardHeader>

            <CardBody className="pt-3">
              <p className="text-body text-ink-soft">
                {ORDER_STATUS[order.status].meaning}
              </p>

              <dl className="mt-3 divide-y divide-hairline border-t border-hairline">
                <DetailRow label="Layanan">{order.service.name}</DetailRow>
                <DetailRow label="IMEI">
                  <DataValue>{order.imei}</DataValue>
                </DetailRow>
                <DetailRow label="Harga dibebankan">
                  <DataValue emphasis>{formatRupiah(order.price)}</DataValue>
                </DetailRow>
                <DetailRow label="Harga dasar layanan">
                  <DataValue className="text-ink-soft">
                    {formatRupiah(order.service.price)}
                  </DataValue>
                </DetailRow>
                <DetailRow label="Kanal">
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
                  <DetailRow label="Diambil admin">
                    <DataValue className="text-ink-soft">
                      {formatDateTime(order.startedAt)}
                    </DataValue>
                  </DetailRow>
                ) : null}
                {order.completedAt ? (
                  <DetailRow label="Diselesaikan">
                    <DataValue className="text-ink-soft">
                      {formatDateTime(order.completedAt)}
                    </DataValue>
                  </DetailRow>
                ) : null}
              </dl>

              {order.notes ? (
                <div className="mt-4 border-t border-hairline pt-4">
                  <p className="text-label uppercase text-ink-soft">
                    Catatan user
                  </p>
                  <p className="mt-1.5 max-w-[70ch] text-body text-ink">
                    {order.notes}
                  </p>
                </div>
              ) : null}

              <AdminOrderStatusOverride
                orderId={order.orderId}
                currentStatus={order.status}
              />
            </CardBody>
          </Card>

          {order.invoice ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-title">Pembayaran</CardTitle>
                <PaymentBadge status={order.invoice.paymentStatus} />
              </CardHeader>
              <CardBody className="pt-4">
                <dl className="divide-y divide-hairline border-t border-hairline">
                  <DetailRow label="Invoice ID">
                    <DataValue>{order.invoice.invoiceId}</DataValue>
                  </DetailRow>
                  <DetailRow label="Jumlah">
                    <DataValue emphasis>
                      {formatRupiah(order.invoice.amount)}
                    </DataValue>
                  </DetailRow>
                  <DetailRow label="Kanal pembayaran">
                    {order.invoice.paymentChannel}
                  </DetailRow>
                  <DetailRow label="Referensi">
                    {order.invoice.paymentReference ? (
                      <DataValue className="text-ink-soft">
                        {order.invoice.paymentReference}
                      </DataValue>
                    ) : (
                      <span className="text-ink-faint">Belum ada</span>
                    )}
                  </DetailRow>
                  <DetailRow label="Kedaluwarsa">
                    <DataValue className="text-ink-soft">
                      {formatDateTime(order.invoice.expiredAt)}
                    </DataValue>
                  </DetailRow>
                  {order.invoice.paidAt ? (
                    <DetailRow label="Dibayar">
                      <DataValue className="text-ink-soft">
                        {formatDateTime(order.invoice.paidAt)}
                      </DataValue>
                    </DetailRow>
                  ) : null}
                </dl>
              </CardBody>
            </Card>
          ) : null}

          {order.result ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-title">Hasil dari admin</CardTitle>
                <ResultBadge status={order.result.resultStatus} />
              </CardHeader>
              <CardBody className="pt-4">
                <p className="max-w-[70ch] text-body text-ink">
                  {order.result.resultNote}
                </p>
                <p className="mt-3 border-t border-hairline pt-3 text-body text-ink-soft">
                  Dikirim{" "}
                  <span className="font-data tabular">
                    {formatDateTime(order.result.createdAt)}
                  </span>
                  {order.assignedAdmin
                    ? ` oleh ${order.assignedAdmin.fullName}`
                    : null}
                </p>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-title">Pihak terkait</CardTitle>
            </CardHeader>
            <CardBody className="pt-4">
              <div className="flex items-center gap-3">
                <Avatar fullName={order.user.fullName} className="size-9" />
                <div className="min-w-0">
                  <p className="text-body font-medium text-ink">
                    {order.user.fullName}
                  </p>
                  <p className="font-data text-body text-ink-soft">
                    @{order.user.username}
                    {order.user.telegramHandle
                      ? ` · ${order.user.telegramHandle}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="mt-4 border-t border-hairline pt-4">
                {order.assignedAdmin ? (
                  <div className="flex items-center gap-3">
                    <Avatar
                      fullName={order.assignedAdmin.fullName}
                      className="size-9"
                    />
                    <div className="min-w-0">
                      <p className="text-body font-medium text-ink">
                        {order.assignedAdmin.fullName}
                      </p>
                      <p className="font-data text-body text-ink-soft">
                        {order.assignedAdmin.telegramHandle
                          ? `${order.assignedAdmin.telegramHandle} · `
                          : ""}
                        admin pemroses
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-body text-ink-soft">
                    Belum ada admin yang mengambil order ini.
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-title">Riwayat aktivitas</CardTitle>
            </CardHeader>
            <CardBody className="pt-4">
              <OrderStepper order={order} />

              <ul className="mt-5 space-y-3 border-t border-hairline pt-4">
                {order.activity.map((log) => (
                  <li key={log.id} className="flex flex-col gap-0.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="text-body font-medium text-ink">
                        {ORDER_STATUS[log.status].label}
                      </p>
                      <time
                        dateTime={log.createdAt}
                        className="font-data tabular text-body text-ink-soft"
                      >
                        {formatDateTime(log.createdAt)}
                      </time>
                    </div>
                    <p className="text-body text-ink-soft">{log.note}</p>
                    <p className="text-body text-ink-faint">Oleh {log.actor}</p>
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
