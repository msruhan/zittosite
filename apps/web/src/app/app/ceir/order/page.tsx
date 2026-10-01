import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/shell/app-shell";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateOrderForm } from "@/components/domain/create-order-form";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import type { Service, User } from "@/lib/types";

export const metadata: Metadata = {
  title: "Buat Order Ceir",
};

const STEPS = [
  {
    step: "01",
    title: "Bayar dengan saldo atau QRIS",
    body: "Saldo akun dipakai lebih dulu. Jika kurang, sisanya dibayar lewat QRIS sebelum hitung mundur habis.",
  },
  {
    step: "02",
    title: "Diproses otomatis",
    body: "Setelah lunas, order langsung diteruskan ke Supplier API tanpa menunggu admin.",
  },
  {
    step: "03",
    title: "Hasil tampil di Order Ceir",
    body: "Status dan hasil pengecekan diperbarui otomatis pada order yang sama.",
  },
];

export default async function CreateCeirOrderPage() {
  let services: Service[] = [];
  let balance = 0;
  try {
    const [list, me] = await Promise.all([
      serverApi<Service[]>("/services?via=supplier"),
      serverApi<User>("/me"),
    ]);
    services = list;
    balance = me.creditBalance ?? 0;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  const priceFor = Object.fromEntries(
    services.map((service) => [service.id, service.price]),
  );

  return (
    <>
      <Link
        href="/app/ceir"
        className="mb-3 inline-flex items-center gap-1.5 text-body font-medium text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Order Ceir
      </Link>
      <PageHeader
        title="Buat order Ceir"
        description="Pilih layanan Ceir, masukkan IMEI, lalu bayar. Order diproses otomatis dan hasilnya tampil di Order Ceir."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <Card>
          <CardBody>
            {services.length > 0 ? (
              <CreateOrderForm
                services={services}
                priceFor={priceFor}
                balance={balance}
                variant="ceir"
              />
            ) : (
              <EmptyState
                title="Belum ada layanan Ceir"
                description="Layanan Ceir belum tersedia saat ini. Silakan coba lagi nanti."
              />
            )}
          </CardBody>
        </Card>

        <aside className="space-y-4">
          <div className="rounded-lg border border-hairline bg-mist p-5">
            <h2 className="text-title text-ink">Yang terjadi setelah ini</h2>
            <ol className="mt-3 space-y-3">
              {STEPS.map((item) => (
                <li key={item.step} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="font-data tabular text-body font-semibold text-action"
                  >
                    {item.step}
                  </span>
                  <div>
                    <p className="text-body font-medium text-ink">{item.title}</p>
                    <p className="text-body text-ink-soft">{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex gap-2.5 rounded-lg border border-hairline bg-surface p-4 shadow-resting">
            <ShieldCheck
              aria-hidden="true"
              weight="regular"
              className="mt-0.5 size-4 shrink-0 text-cleared-ink"
            />
            <p className="text-body text-ink-soft">
              IMEI Anda hanya ditampilkan sebagian pada daftar order dan hanya
              dipakai untuk memproses pengecekan.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
