import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { GroupEditor } from "@/components/domain/group-editor";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import type { Service, User, UserGroup } from "@/lib/types";

export const metadata: Metadata = {
  title: "Kelola Group",
};

export default async function AdminGroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  let groups: UserGroup[];
  let services: Service[];
  let users: User[];
  try {
    const me = await serverApi<{ role: string }>("/admin/me");
    if (me.role !== "super_admin") redirect("/admin/orders");
    [groups, services, users] = await Promise.all([
      serverApi<UserGroup[]>("/admin/groups"),
      serverApi<Service[]>("/admin/services"),
      serverApi<User[]>("/admin/users"),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/admin/login");
    if (err instanceof ApiError && err.status === 403) redirect("/admin/orders");
    throw err;
  }
  const group = groups.find((g) => g.id === groupId);
  if (!group) notFound();

  return (
    <>
      <Link
        href="/admin/groups"
        className="mb-4 inline-flex items-center gap-1.5 text-body font-medium text-ink-soft underline-offset-4 transition-colors duration-150 ease-out-strong hover:text-ink hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Semua group
      </Link>
      <GroupEditor initialGroup={group} services={services} users={users} />
    </>
  );
}
