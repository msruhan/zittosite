import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/app-shell";
import { ServiceManagement } from "@/components/domain/service-management";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import type { Admin, Service, Supplier } from "@/lib/types";

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
  try {
    [services, admins, suppliers] = await Promise.all([
      serverApi<Service[]>("/admin/services"),
      serverApi<Admin[]>("/admin/admins"),
      serverApi<Supplier[]>("/admin/suppliers"),
    ]);
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
        operators={admins.filter((admin) => admin.role !== "super_admin")}
        suppliers={suppliers}
      />
    </>
  );
}
