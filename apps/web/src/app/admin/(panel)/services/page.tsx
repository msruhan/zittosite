import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/app-shell";
import { ServiceManagement } from "@/components/domain/service-management";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import type { Service } from "@/lib/types";

export const metadata: Metadata = {
  title: "Services",
};

export default async function AdminServicesPage() {
  let services: Service[] = [];
  try {
    services = await serverApi<Service[]>("/admin/services");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/admin/login");
    throw err;
  }

  return (
    <>
      <PageHeader
        title="Services"
        description="Atur layanan aktivasi, harga, dan status aktif."
      />
      <ServiceManagement initialServices={services} />
    </>
  );
}
