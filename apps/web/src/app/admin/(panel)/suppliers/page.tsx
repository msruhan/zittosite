import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/app-shell";
import { SupplierManagement } from "@/components/domain/supplier-management";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import type { Supplier } from "@/lib/types";

export const metadata: Metadata = {
  title: "Supplier API",
};

export default async function AdminSuppliersPage() {
  let suppliers: Supplier[];
  try {
    const me = await serverApi<{ role: string }>("/admin/me");
    if (me.role !== "super_admin") redirect("/admin/orders");
    suppliers = await serverApi<Supplier[]>("/admin/suppliers");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/admin/login");
    if (err instanceof ApiError && err.status === 403) redirect("/admin/orders");
    throw err;
  }

  return (
    <>
      <PageHeader
        title="Supplier API"
        description="Panel Dhru Fusion (mis. CeirBot) tempat order layanan berjalur API Supplier diteruskan dan diproses otomatis."
      />
      <SupplierManagement initialSuppliers={suppliers} />
    </>
  );
}
