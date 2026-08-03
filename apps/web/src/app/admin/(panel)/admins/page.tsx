import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/app-shell";
import { AdminManagement } from "@/components/domain/admin-management";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import type { Admin } from "@/lib/types";

export const metadata: Metadata = {
  title: "Manajemen Admin",
};

export default async function AdminAdminsPage() {
  let me: { role: string };
  try {
    me = await serverApi<{ role: string }>("/admin/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect("/admin/login");
    }
    throw err;
  }
  if (me.role !== "super_admin") {
    redirect("/admin/dashboard");
  }

  let admins: Admin[];
  try {
    admins = await serverApi<Admin[]>("/admin/admins");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect("/admin/login");
    }
    if (err instanceof ApiError && err.status === 403) {
      redirect("/admin/dashboard");
    }
    throw err;
  }

  return (
    <>
      <PageHeader
        title="Manajemen admin"
        description="Tambah, blokir, atau aktifkan admin yang mengerjakan order lewat Telegram."
      />
      <AdminManagement initialAdmins={admins} />
    </>
  );
}
