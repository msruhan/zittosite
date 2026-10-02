import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/app-shell";
import { OrderHistory } from "@/components/domain/order-history";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import type { OrderDetail } from "@/lib/types";

export const metadata: Metadata = {
  title: "Layanan Spesial",
};

export default async function SpecialOrdersPage() {
  let orders: OrderDetail[] = [];
  try {
    orders = await serverApi<OrderDetail[]>("/orders?via=special");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  return (
    <>
      <PageHeader
        title="Layanan Spesial"
        description="Order Layanan Spesial Anda yang diproses otomatis oleh Supplier API."
      />
      <OrderHistory
        orders={orders}
        fetchedAt={new Date().toISOString()}
        emptyTitle="Belum ada order Layanan Spesial"
        emptyDescription="Order Layanan Spesial yang Anda buat akan muncul di sini beserta status dan hasilnya."
        createHref="/app/spesial/order"
      />
    </>
  );
}
