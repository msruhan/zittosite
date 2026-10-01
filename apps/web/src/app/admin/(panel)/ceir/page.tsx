import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/app-shell";
import { AdminOrderManagement } from "@/components/domain/admin-order-management";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import type { OrderDetail } from "@/lib/types";

export const metadata: Metadata = {
  title: "Order Ceir",
};

export default async function AdminOrderCeirPage() {
  let me: { role: string };
  let orders: OrderDetail[] = [];
  try {
    me = await serverApi<{ role: string }>("/admin/me");
    if (me.role !== "super_admin") redirect("/admin/orders");
    orders = await serverApi<OrderDetail[]>("/admin/orders?via=supplier");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/admin/login");
    throw err;
  }

  return (
    <>
      <PageHeader
        title="Order Ceir"
        description="Semua order yang diteruskan ke supplier CeirBot lewat API key, lengkap dengan referensi dan error dari supplier."
      />
      <AdminOrderManagement
        orders={orders}
        fetchedAt={new Date().toISOString()}
        showCustomerIdentity
        canEditStatus
        supplierView
      />
    </>
  );
}
