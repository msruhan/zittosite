import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/app-shell";
import { UserManagement } from "@/components/domain/user-management";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import type { User } from "@/lib/types";

export const metadata: Metadata = {
  title: "Users",
};

export default async function AdminUsersPage() {
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

  let users: User[] = [];
  try {
    users = await serverApi<User[]>("/admin/users");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/admin/login");
    if (err instanceof ApiError && err.status === 403) redirect("/admin/orders");
    throw err;
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="Kelola akun user portal: buat, edit, suspend, dan akses bot."
      />
      <UserManagement initialUsers={users} />
    </>
  );
}
