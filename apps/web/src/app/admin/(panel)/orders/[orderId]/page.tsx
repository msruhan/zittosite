import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
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
import { AdminCancelOrder } from "@/components/domain/admin-cancel-order";
import { AdminOrderReason } from "@/components/domain/admin-order-reason";
import { CeirResultView } from "@/components/domain/ceir-result-view";
import { Avatar } from "@/components/shell/user-chip";
import { ORDER_STATUS } from "@/lib/status";
import { deviceLabel, orderExtraRows } from "@/lib/order-fields";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { ORDER_CHANNEL_LABEL, type OrderDetail } from "@/lib/types";

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
  let me: { role: string };
  let order: OrderDetail;
  try {
    me = await serverApi<{ role: string }>("/admin/me");
    order = await serverApi<OrderDetail>(`/admin/orders/${orderId}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/admin/login");
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const isSuperAdmin = me.role === "super_admin";
  const showCustomer = isSuperAdmin && order.user;
  const isClosed = order.status === "rejected" || order.status === "cancel";

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
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {order.isTest ? (
                  <Tag className="border-working-edge bg-working-wash text-working-ink">🧪 Testing</Tag>
                ) : null}
                <StatusBadge status={order.status} />
              </div>
            </CardHeader>

            <CardBody className="pt-3">
              <p className="text-body text-ink-soft">
                {ORDER_STATUS[order.status].meaning}
              </p>

              <dl className="mt-3 divide-y divide-hairline border-t border-hairline">
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
                    {ORDER_CHANNEL_LABEL[order.channel]}
                  </Tag>
                </DetailRow>
                {order.supplier ? (
                  <DetailRow label="Supplier">
                    <span className="text-ink">{order.supplier.name}</span>
                    {order.supplier.reference ? (
                      <DataValue className="ml-2 text-ink-soft">
                        Ref {order.supplier.reference}
                      </DataValue>
                    ) : (
                      <span className="ml-2 text-label text-ink-faint">
                        Belum terkirim ({order.supplier.attempts}× dicoba)
                      </span>
                    )}
                    {order.supplier.error ? (
                      <p className="mt-1 text-label text-refused-ink">
                        {order.supplier.error}
                      </p>
                    ) : null}
                  </DetailRow>
                ) : null}
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
                {isClosed ? (
                  <DetailRow label="Keterangan">
                    {order.statusReason ?? (
                      <span className="text-ink-faint">Tidak ada keterangan</span>
                    )}
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

              {isSuperAdmin &&
              ["waiting_payment", "paid", "waiting_action", "in_process"].includes(
                order.status,
              ) ? (
                <AdminCancelOrder
                  orderId={order.orderId}
                  paid={order.invoice?.paymentStatus === "paid"}
                />
              ) : null}

              {isSuperAdmin && isClosed ? (
                <AdminOrderReason
                  orderId={order.orderId}
                  currentReason={order.statusReason ?? null}
                />
              ) : null}

              {isSuperAdmin ? (
                <AdminOrderStatusOverride
                  orderId={order.orderId}
                  currentStatus={order.status}
                />
              ) : null}
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
                <CeirResultView text={order.result.resultNote} />
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
              {showCustomer && order.user ? (
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
              ) : (
                <p className="text-body text-ink-soft">
                  Identitas pelanggan disembunyikan untuk peran Admin.
                </p>
              )}

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
              <OrderStepper order={order} internal />

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
                    <p className="whitespace-pre-line text-body text-ink-soft">{log.note}</p>
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
