import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/app-shell";
import { PaymentGatewaySettings } from "@/components/domain/payment-gateway-settings";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Pembayaran",
};

export default async function AdminPaymentsPage() {
  try {
    const me = await serverApi<{ role: string }>("/admin/me");
    if (me.role !== "super_admin") redirect("/admin/orders");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/admin/login");
    if (err instanceof ApiError && err.status === 403) redirect("/admin/orders");
    throw err;
  }

  return (
    <>
      <PageHeader
        title="Pembayaran"
        description="Pilih gateway untuk invoice baru. Invoice yang sudah terbit tetap diselesaikan oleh gateway yang membuatnya."
      />
      <PaymentGatewaySettings />
    </>
  );
}
