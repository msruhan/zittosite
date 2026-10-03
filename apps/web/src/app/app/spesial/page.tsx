import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/app-shell";
import { OrderHistory } from "@/components/domain/order-history";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import type { OrderDetail } from "@/lib/types";
import { loadUserMenus } from "@/lib/server-user-menus";
import type { UserMenus } from "@/lib/user-menus";

export const metadata: Metadata = {
  title: "Layanan Spesial",
};

export default async function SpecialOrdersPage() {
  let orders: OrderDetail[] = [];
  let menus: UserMenus;
  try {
    [orders, menus] = await Promise.all([
      serverApi<OrderDetail[]>("/orders?via=special"),
      loadUserMenus(),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  return (
    <>
      <PageHeader
        title={menus.special.label}
        description={`Order ${menus.special.label} Anda yang diproses otomatis.`}
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
