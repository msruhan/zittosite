import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/app-shell";
import {
  AdminOrderManagement,
  type OrderHandler,
} from "@/components/domain/admin-order-management";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import type { OrderDetail } from "@/lib/types";

export const metadata: Metadata = {
  title: "Orders",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; admin?: string; from?: string; to?: string }>;
}) {
  const { q, admin, from, to } = await searchParams;
  let me: { role: string };
  let orders: OrderDetail[] = [];
  let handlers: OrderHandler[] = [];
  try {
    me = await serverApi<{ role: string }>("/admin/me");
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (admin) params.set("admin", admin);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.toString();
    [orders, handlers] = await Promise.all([
      serverApi<OrderDetail[]>(query ? `/admin/orders?${query}` : "/admin/orders"),
      serverApi<OrderHandler[]>("/admin/orders-handlers"),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/admin/login");
    throw err;
  }

  const showCustomerIdentity = me.role === "super_admin";

  return (
    <>
      <PageHeader
        title="Orders"
        description="Semua order di sistem. Operasional harian admin tetap di Telegram."
      />
      <AdminOrderManagement
        orders={orders}
        fetchedAt={new Date().toISOString()}
        initialQuery={q ?? ""}
        showCustomerIdentity={showCustomerIdentity}
        canEditStatus={me.role === "super_admin"}
        serverFilters={{ admin: admin ?? "", from: from ?? "", to: to ?? "", handlers }}
      />
    </>
  );
}
