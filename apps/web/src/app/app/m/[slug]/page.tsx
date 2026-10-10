import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/app-shell";
import { OrderHistory } from "@/components/domain/order-history";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import type { OrderDetail } from "@/lib/types";
import { loadUserMenus, requireServiceMenu } from "@/lib/server-user-menus";
import { menuOrderHref } from "@/lib/user-menus";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const menu = (await loadUserMenus()).menus.find((entry) => entry.slug === slug);
  return { title: menu?.label ?? "Layanan" };
}

export default async function ServiceMenuOrdersPage({ params }: Params) {
  const { slug } = await params;
  const menu = await requireServiceMenu(slug);
  let orders: OrderDetail[] = [];
  try {
    orders = await serverApi<OrderDetail[]>(`/orders?via=${encodeURIComponent(slug)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  return (
    <>
      <PageHeader
        title={menu.label}
        description={`Order ${menu.label} Anda yang diproses otomatis.`}
      />
      <OrderHistory
        orders={orders}
        fetchedAt={new Date().toISOString()}
        emptyTitle={`Belum ada order ${menu.label}`}
        emptyDescription={`Order ${menu.label} yang Anda buat akan muncul di sini beserta status dan hasilnya.`}
        createHref={menuOrderHref(slug)}
      />
    </>
  );
}
