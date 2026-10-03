import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/app-shell";
import { GroupManagement } from "@/components/domain/group-management";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import type { Service, UserGroup } from "@/lib/types";

export const metadata: Metadata = {
  title: "Groups",
};

export default async function AdminGroupsPage() {
  let groups: UserGroup[];
  let services: Service[];
  try {
    const me = await serverApi<{ role: string }>("/admin/me");
    if (me.role !== "super_admin") redirect("/admin/orders");
    [groups, services] = await Promise.all([
      serverApi<UserGroup[]>("/admin/groups"),
      serverApi<Service[]>("/admin/services"),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/admin/login");
    if (err instanceof ApiError && err.status === 403) redirect("/admin/orders");
    throw err;
  }

  return (
    <>
      <PageHeader
        title="Groups"
        description="Beri harga khusus untuk sekelompok user. User tanpa group membayar harga default layanan."
      />
      <GroupManagement initialGroups={groups} services={services} />
    </>
  );
}
