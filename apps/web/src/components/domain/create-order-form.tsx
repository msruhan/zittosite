"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Info, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { DataValue } from "@/components/ui/data-value";
import { ApiError, api } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import type { Service } from "@/lib/types";

const IMEI_LENGTH = 15;

export function CreateOrderForm({
  services,
  priceFor,
}: {
  services: Service[];
  /** Resolved server-side so a negotiated price is never guessed here. */
  priceFor: Record<string, number>;
}) {
  const router = useRouter();
  const [serviceId, setServiceId] = React.useState<string>("");
  const [imei, setImei] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [errors, setErrors] = React.useState<{
    serviceId?: string;
    imei?: string;
  }>({});
  const [submitting, setSubmitting] = React.useState(false);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const price = service ? priceFor[service.id] : null;

  function handleImeiChange(event: React.ChangeEvent<HTMLInputElement>) {
    const digitsOnly = event.target.value.replace(/\D/g, "").slice(0, IMEI_LENGTH);
    setImei(digitsOnly);
    if (errors.imei) setErrors((e) => ({ ...e, imei: undefined }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: typeof errors = {};
    if (!serviceId) {
      nextErrors.serviceId = "Pilih layanan yang ingin Anda gunakan.";
    }
    if (imei.length === 0) {
      nextErrors.imei = "Masukkan IMEI perangkat Anda.";
    } else if (imei.length !== IMEI_LENGTH) {
      nextErrors.imei = `IMEI terdiri dari ${IMEI_LENGTH} angka. Saat ini ${imei.length} angka.`;
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const order = await api<{ orderId: string }>("/orders", {
        method: "POST",
        body: JSON.stringify({
          serviceId,
          imei,
          notes: notes.trim() || undefined,
        }),
      });
      toast.success("Order dibuat", {
        description: "Invoice QRIS sudah diterbitkan. Selesaikan pembayaran.",
      });
      router.push(`/app/order/${order.orderId}/bayar`);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Gagal membuat order.";
      toast.error("Gagal", { description: message });
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <Field
        label="Layanan"
        htmlFor="service"
        error={errors.serviceId}
        required
        hint="Harga mengikuti layanan yang dipilih."
      >
        <Select
          id="service"
          value={serviceId}
          onValueChange={(value) => {
            setServiceId(value);
            if (errors.serviceId)
              setErrors((e) => ({ ...e, serviceId: undefined }));
          }}
          invalid={Boolean(errors.serviceId)}
          placeholder="Pilih layanan"
          options={services.map((item) => ({
            value: item.id,
            label: item.name,
            hint: formatRupiah(priceFor[item.id]),
          }))}
        />
      </Field>

      {service ? (
        <div className="flex gap-2.5 rounded-md border border-hairline bg-mist px-3.5 py-3">
          <Info
            aria-hidden="true"
            strokeWidth={1.5}
            className="mt-0.5 size-4 shrink-0 text-ink-soft"
          />
          <div className="space-y-1">
            <p className="text-body text-ink">{service.description}</p>
            <p className="text-body text-ink-soft">
              Estimasi pengerjaan{" "}
              <span className="font-data tabular">{service.estimate}</span>
            </p>
          </div>
        </div>
      ) : null}

      <Field
        label="IMEI"
        htmlFor="imei"
        error={errors.imei}
        required
        hint={`${imei.length} dari ${IMEI_LENGTH} angka. Ketik *#06# pada perangkat untuk melihat IMEI.`}
      >
        <Input
          id="imei"
          name="imei"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Contoh 356938035643809"
          className="font-data tabular tracking-[0.02em]"
          value={imei}
          invalid={Boolean(errors.imei)}
          onChange={handleImeiChange}
        />
      </Field>

      <div
        role="note"
        className="flex gap-2.5 rounded-md border border-hold-edge bg-hold-wash px-3.5 py-3"
      >
        <Info
          aria-hidden="true"
          strokeWidth={1.5}
          className="mt-0.5 size-4 shrink-0 text-hold-ink"
        />
        <p className="text-body text-hold-ink">
          Pastikan IMEI yang di-submit wajib berstatus{" "}
          <span className="font-semibold">UNKNOWN</span>. Silakan cek CEIR
          melalui{" "}
          <a
            href="https://infoceir.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline underline-offset-2 hover:opacity-80"
          >
            infoceir.com
          </a>
          .
        </p>
      </div>

      <Field
        label="Catatan"
        htmlFor="notes"
        hint="Opsional. Tuliskan hal yang perlu admin ketahui."
      >
        <Textarea
          id="notes"
          name="notes"
          placeholder="Misalnya merek dan tipe perangkat, atau kebutuhan khusus."
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>

      <div className="flex items-baseline justify-between gap-4 border-t border-hairline pt-4">
        <span className="text-body text-ink-soft">Total yang harus dibayar</span>
        <DataValue emphasis className="text-headline">
          {price !== null ? formatRupiah(price) : "—"}
        </DataValue>
      </div>

      <Button type="submit" block loading={submitting} loadingLabel="Membuat order">
        <QrCode className="size-4" aria-hidden="true" />
        Buat order dan terbitkan QRIS
      </Button>
    </form>
  );
}
