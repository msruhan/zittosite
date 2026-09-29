import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/app-shell";
import {
  ActivityLogTable,
  type ActivityPage,
} from "@/components/domain/activity-log-table";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Log Aktivitas",
};

type Search = { category?: string; q?: string; range?: string; page?: string };

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { category = "all", q = "", range = "7d", page = "1" } =
    await searchParams;
  const params = new URLSearchParams({ category, range, page });
  if (q) params.set("q", q);

  let data: ActivityPage;
  try {
    data = await serverApi<ActivityPage>(`/admin/activity?${params}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/admin/login");
    if (err instanceof ApiError && err.status === 403) {
      redirect("/admin/dashboard");
    }
    throw err;
  }

  return (
    <>
      <PageHeader
        title="Log Aktivitas"
        description="Jejak lengkap login, logout, order, pembayaran, dan perubahan data oleh semua role."
      />
      <ActivityLogTable
        data={data}
        filters={{ category, q, range }}
      />
    </>
  );
}
