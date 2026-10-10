import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/app-shell";
import { ServiceManagement } from "@/components/domain/service-management";
import { ApiError } from "@/lib/api";
import { DEFAULT_USD_RATE } from "@/lib/format";
import { serverApi } from "@/lib/server-api";
import type { Admin, Service, ServiceGroup, Supplier } from "@/lib/types";
import type { UserMenus, UserServiceMenu } from "@/lib/user-menus";

export const metadata: Metadata = {
  title: "Services",
};

export default async function AdminServicesPage() {
  let me: { role: string };
  try {
    me = await serverApi<{ role: string }>("/admin/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/admin/login");
    throw err;
  }
  if (me.role !== "super_admin") {
    redirect("/admin/orders");
  }

  let services: Service[] = [];
  let admins: Admin[] = [];
  let suppliers: Supplier[] = [];
  let groups: ServiceGroup[] = [];
  let usdRate = DEFAULT_USD_RATE;
  let menus: UserServiceMenu[] = [];
  try {
    let rate: { rate: number };
    let userMenus: UserMenus;
    [services, admins, suppliers, groups, rate, userMenus] = await Promise.all([
      serverApi<Service[]>("/admin/services"),
      serverApi<Admin[]>("/admin/admins"),
      serverApi<Supplier[]>("/admin/suppliers"),
      serverApi<ServiceGroup[]>("/admin/service-groups"),
      serverApi<{ rate: number }>("/admin/usd-rate"),
      serverApi<UserMenus>("/admin/user-menus"),
    ]);
    usdRate = rate.rate;
    menus = userMenus.menus;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/admin/login");
    if (err instanceof ApiError && err.status === 403) redirect("/admin/orders");
    throw err;
  }

  return (
    <>
      <PageHeader
        title="Services"
        description="Atur layanan, harga, status aktif, dan operator yang menanganinya."
      />
      <ServiceManagement
        initialServices={services}
        initialGroups={groups}
        initialUsdRate={usdRate}
        operators={[
          ...admins.filter((admin) => admin.role === "super_admin"),
          ...admins.filter((admin) => admin.role !== "super_admin"),
        ]}
        suppliers={suppliers}
        menus={menus}
      />
    </>
  );
}
