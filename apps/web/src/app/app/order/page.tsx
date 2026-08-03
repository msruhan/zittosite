import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { Card, CardBody } from "@/components/ui/card";
import { CreateOrderForm } from "@/components/domain/create-order-form";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import type { Service } from "@/lib/types";

export const metadata: Metadata = {
  title: "Buat Order",
};

export default async function CreateOrderPage() {
  let services: Service[] = [];
  try {
    services = await serverApi<Service[]>("/services");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  const priceFor = Object.fromEntries(
    services.map((service) => [service.id, service.price]),
  );

  return (
    <>
      <PageHeader
        title="Buat order"
        description="Pilih layanan, masukkan IMEI perangkat, lalu selesaikan pembayaran. Nomor tiket Anda terbit begitu order dibuat."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <Card>
          <CardBody>
            <CreateOrderForm services={services} priceFor={priceFor} />
          </CardBody>
        </Card>

        <aside className="space-y-4">
          <div className="rounded-lg border border-hairline bg-mist p-5">
            <h2 className="text-title text-ink">Yang terjadi setelah ini</h2>
            <ol className="mt-3 space-y-3">
              {[
                {
                  step: "01",
                  title: "Invoice QRIS terbit",
                  body: "Anda punya 30 menit untuk menyelesaikan pembayaran.",
                },
                {
                  step: "02",
                  title: "Order masuk antrean admin",
                  body: "Setelah pembayaran terverifikasi, admin menerima notifikasi Telegram.",
                },
                {
                  step: "03",
                  title: "Hasil dikirim ke tiket",
                  body: "Hasil pengerjaan tampil pada order yang sama dan dikirim ke Telegram Anda.",
                },
              ].map((item) => (
                <li key={item.step} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="font-data tabular text-body font-semibold text-action"
                  >
                    {item.step}
                  </span>
                  <div>
                    <p className="text-body font-medium text-ink">
                      {item.title}
                    </p>
                    <p className="text-body text-ink-soft">{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex gap-2.5 rounded-lg border border-hairline bg-surface p-4 shadow-resting">
            <ShieldCheck
              aria-hidden="true"
              strokeWidth={1.5}
              className="mt-0.5 size-4 shrink-0 text-cleared-ink"
            />
            <p className="text-body text-ink-soft">
              IMEI Anda hanya ditampilkan sebagian pada daftar order, dan tidak
              pernah dikirim ke pihak ketiga.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
