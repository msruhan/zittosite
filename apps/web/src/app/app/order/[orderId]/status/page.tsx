import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DataValue, TicketId } from "@/components/ui/data-value";
import { Reveal } from "@/components/ui/reveal";
import { StatusBadge } from "@/components/ui/status-badge";
import { TicketStub } from "@/components/ui/ticket-stub";
import { OrderStepper } from "@/components/domain/order-stepper";
import { ORDER_STATUS } from "@/lib/status";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import { maskImei } from "@/lib/format";
import type { OrderDetail } from "@/lib/types";

export const metadata: Metadata = {
  title: "Status Order",
};

export default async function OrderStatusPage({
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
    <div className="mx-auto w-full max-w-2xl">
      <Link
        href="/app/riwayat"
        className="mb-4 inline-flex items-center gap-1.5 text-body font-medium text-ink-soft underline-offset-4 transition-colors duration-150 ease-out-strong hover:text-ink hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Riwayat order
      </Link>

      <Reveal as="article">
        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <p className="text-label uppercase text-ink-soft">Order ID</p>
              <TicketId className="mt-1 block">{order.orderId}</TicketId>
            </div>
            <StatusBadge status={order.status} stampIn />
          </CardHeader>

          <CardBody className="pt-3">
            <p className="text-body text-ink-soft">
              {ORDER_STATUS[order.status].meaning}
            </p>

            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-y border-hairline py-3">
              <div>
                <dt className="text-label uppercase text-ink-soft">Layanan</dt>
                <dd className="mt-0.5 text-body font-medium text-ink">
                  {order.service.name}
                </dd>
              </div>
              <div>
                <dt className="text-label uppercase text-ink-soft">IMEI</dt>
                <dd className="mt-0.5">
                  <DataValue>{maskImei(order.imei)}</DataValue>
                </dd>
              </div>
              {order.assignedAdmin ? (
                <div>
                  <dt className="text-label uppercase text-ink-soft">
                    Admin pemroses
                  </dt>
                  <dd className="mt-0.5 text-body font-medium text-ink">
                    {order.assignedAdmin.fullName}
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-5">
              <CardTitle className="text-title">Perjalanan order</CardTitle>
              <div className="mt-4">
                <OrderStepper order={order} />
              </div>
            </div>
          </CardBody>

          <div className="border-t border-hairline px-4 py-3 sm:px-5">
            {order.status === "waiting_payment" ? (
              <Button asChild block>
                <Link href={`/app/order/${order.orderId}/bayar`}>
                  Selesaikan pembayaran
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" block>
                <Link href={`/app/order/${order.orderId}`}>
                  Lihat detail lengkap
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            )}
          </div>
          <TicketStub />
        </Card>
      </Reveal>
    </div>
  );
}
