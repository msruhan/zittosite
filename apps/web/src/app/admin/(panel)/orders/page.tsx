import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/app-shell";
import { AdminOrderManagement } from "@/components/domain/admin-order-management";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import type { OrderDetail } from "@/lib/types";

export const metadata: Metadata = {
  title: "Orders",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  let orders: OrderDetail[] = [];
  try {
    const path = q
      ? `/admin/orders?q=${encodeURIComponent(q)}`
      : "/admin/orders";
    orders = await serverApi<OrderDetail[]>(path);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/admin/login");
    throw err;
  }

  return (
    <>
      <PageHeader
        title="Orders"
        description="Semua order di sistem. Operasional harian admin tetap di Telegram."
      />
      <AdminOrderManagement orders={orders} initialQuery={q ?? ""} />
    </>
  );
}
