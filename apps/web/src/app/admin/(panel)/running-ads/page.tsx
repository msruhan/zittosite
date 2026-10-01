import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/app-shell";
import { RunningAdsManagement } from "@/components/domain/running-ads-management";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import type { RunningAd } from "@/lib/types";

export const metadata: Metadata = {
  title: "Ads Runner",
};

export default async function AdminRunningAdsPage() {
  let ads: RunningAd[];
  try {
    const me = await serverApi<{ role: string }>("/admin/me");
    if (me.role !== "super_admin") redirect("/admin/orders");
    ads = await serverApi<RunningAd[]>("/admin/running-ads");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/admin/login");
    if (err instanceof ApiError && err.status === 403) redirect("/admin/orders");
    throw err;
  }

  return (
    <>
      <PageHeader
        title="Ads Runner"
        description="Teks berjalan di bawah header portal user. Pakai untuk promo, info layanan, atau pengumuman singkat."
      />
      <RunningAdsManagement initialAds={ads} />
    </>
  );
}
