import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import { AdminSettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function AdminSettingsPage() {
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

  return <AdminSettingsForm />;
}
