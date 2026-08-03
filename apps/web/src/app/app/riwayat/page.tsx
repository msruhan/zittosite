import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/app-shell";
import { OrderHistory } from "@/components/domain/order-history";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import type { OrderDetail } from "@/lib/types";

export const metadata: Metadata = {
  title: "Riwayat Order",
};

export default async function RiwayatPage() {
  let orders: OrderDetail[] = [];
  try {
    orders = await serverApi<OrderDetail[]>("/orders");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  return (
    <>
      <PageHeader
        title="Riwayat order"
        description="Semua order Anda, dari yang baru dibuat sampai yang sudah selesai."
      />
      <OrderHistory orders={orders} />
    </>
  );
}
