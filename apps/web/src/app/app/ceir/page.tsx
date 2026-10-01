import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/app-shell";
import { OrderHistory } from "@/components/domain/order-history";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import type { OrderDetail } from "@/lib/types";

export const metadata: Metadata = {
  title: "Order Ceir",
};

export default async function OrderCeirPage() {
  let orders: OrderDetail[] = [];
  try {
    orders = await serverApi<OrderDetail[]>("/orders?via=supplier");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  return (
    <>
      <PageHeader
        title="Order Ceir"
        description="Order Anda untuk layanan Ceir yang diproses otomatis oleh CeirBot."
      />
      <OrderHistory
        orders={orders}
        fetchedAt={new Date().toISOString()}
        emptyTitle="Belum ada order Ceir"
        emptyDescription="Order layanan Ceir yang Anda buat akan muncul di sini beserta status dan hasilnya."
      />
    </>
  );
}
