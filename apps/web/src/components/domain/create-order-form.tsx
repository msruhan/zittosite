"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info, QrCode, Wallet } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Combobox } from "@/components/ui/combobox";
import { DataValue } from "@/components/ui/data-value";
import { ImeiChipInput } from "@/components/domain/imei-chip-input";
import { RichDescription } from "@/components/domain/rich-description";
import { ApiError, api } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import {
  IMEI_LENGTH,
  INPUT_TYPE_LABEL,
  MAX_BULK_IMEIS,
  inputLengthError,
  type InputType,
} from "@/lib/imei-list";
import type { Service } from "@/lib/types";

// Keep in sync with apps/api/src/orders/special-fields.ts.
const QNT_MAX = 100_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ExtraValues = { qnt: string; email: string; username: string };
type ExtraErrors = Partial<Record<keyof ExtraValues, string>>;
const EMPTY_EXTRAS: ExtraValues = { qnt: "", email: "", username: "" };

function validateExtras(service: Service, values: ExtraValues): ExtraErrors {
  const errors: ExtraErrors = {};
  if (service.requireQnt) {
    const qnt = Number(values.qnt.trim());
    if (!values.qnt.trim()) errors.qnt = "Masukkan Qnt.";
    else if (!Number.isInteger(qnt) || qnt < 1 || qnt > QNT_MAX) {
      errors.qnt = `Qnt harus bilangan bulat 1–${QNT_MAX.toLocaleString("id-ID")}.`;
    }
  }
  if (service.requireEmail) {
    const email = values.email.trim();
    if (!email) errors.email = "Masukkan email.";
    else if (!EMAIL_PATTERN.test(email)) errors.email = "Format email tidak valid.";
  }
  if (service.requireUsername && !values.username.trim()) {
    errors.username = "Masukkan username.";
  }
  return errors;
}

export function CreateOrderForm({
  services,
  priceFor,
  balance,
  variant = "regular",
}: {
  services: Service[];
  /** Resolved server-side so a negotiated price is never guessed here. */
  priceFor: Record<string, number>;
  /** Account balance; spent before QRIS at checkout. */
  balance: number;
  /** "ceir" orders run automatically, so admin-facing notes and the UNKNOWN rule do not apply. */
  variant?: "regular" | "ceir";
}) {
  const ceir = variant === "ceir";
  const router = useRouter();
  const [serviceId, setServiceId] = React.useState<string>("");
  const [imeis, setImeis] = React.useState<string[]>([]);
  const [draft, setDraft] = React.useState("");
  const [imeiError, setImeiError] = React.useState<string>();
  const [notes, setNotes] = React.useState("");
  const [serviceError, setServiceError] = React.useState<string>();
  const [extras, setExtras] = React.useState<ExtraValues>(EMPTY_EXTRAS);
  const [extraErrors, setExtraErrors] = React.useState<ExtraErrors>({});

  function updateExtra(key: keyof ExtraValues, value: string) {
    setExtras((current) => ({ ...current, [key]: value }));
    setExtraErrors((current) => ({ ...current, [key]: undefined }));
  }
  const [submitting, setSubmitting] = React.useState(false);

  const serviceOptions = React.useMemo(() => {
    const grouped = services.some((s) => s.group);
    const ordered = grouped
      ? [...services.filter((s) => s.group)]
          .sort((a, b) => a.group!.localeCompare(b.group!))
          .concat(services.filter((s) => !s.group))
      : services;
    return ordered.map((item) => ({
      value: item.id,
      label: item.name,
      hint: formatRupiah(priceFor[item.id]),
      group: grouped ? (item.group ?? "Lainnya") : undefined,
    }));
  }, [services, priceFor]);
  const service = services.find((s) => s.id === serviceId) ?? null;
  const noDevice = service?.inputType === "none";
  const inputType: InputType =
    service?.inputType && service.inputType !== "none" ? service.inputType : "imei";
  const label = INPUT_TYPE_LABEL[inputType];
  const price = service ? priceFor[service.id] : null;
  const draftComplete =
    !noDevice &&
    !inputLengthError(draft, inputType) &&
    !imeis.includes(draft) &&
    imeis.length < MAX_BULK_IMEIS;
  const quantity = noDevice ? 1 : imeis.length + (draftComplete ? 1 : 0);
  const total = price !== null ? price * Math.max(quantity, 1) : null;
  const balanceUsed = total !== null ? Math.min(Math.max(balance, 0), total) : 0;
  const due = total !== null ? total - balanceUsed : null;
  const paidByBalance = due === 0;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setServiceError(
      serviceId ? undefined : "Pilih layanan yang ingin Anda gunakan.",
    );
    const nextExtraErrors = service ? validateExtras(service, extras) : {};
    setExtraErrors(nextExtraErrors);
    const extrasInvalid = Object.keys(nextExtraErrors).length > 0;
    const finalImeis = noDevice ? [] : draftComplete ? [...imeis, draft] : imeis;
    let problem: string | undefined;
    if (noDevice) {
      problem = undefined;
    } else if (draft && !draftComplete) {
      const lengthProblem = inputLengthError(draft, inputType);
      problem = lengthProblem
        ? inputType === "imei"
          ? `IMEI terakhir baru ${draft.length} dari ${IMEI_LENGTH} digit. Lengkapi atau hapus dulu.`
          : `${label} terakhir belum valid: ${lengthProblem}`
        : `${label} terakhir sudah ditambahkan atau melebihi batas. Hapus dulu.`;
    } else if (finalImeis.length === 0) {
      problem = `Masukkan ${label} perangkat Anda.`;
    }
    setImeiError(problem);
    if (!serviceId || problem || extrasInvalid) return;
    if (draftComplete) {
      setImeis(finalImeis);
      setDraft("");
    }

    setSubmitting(true);
    try {
      const order = await api<{ orderId: string; status: string }>("/orders", {
        method: "POST",
        body: JSON.stringify({
          serviceId,
          imeis: finalImeis,
          notes: notes.trim() || undefined,
          ...(service?.requireQnt ? { qnt: extras.qnt.trim() } : {}),
          ...(service?.requireEmail ? { email: extras.email.trim() } : {}),
          ...(service?.requireUsername ? { username: extras.username.trim() } : {}),
        }),
      });
      const title = quantity > 1 ? `${quantity} order dibuat` : "Order dibuat";
      if (order.status !== "waiting_payment") {
        toast.success(title, {
          description: ceir
            ? "Lunas dengan saldo akun. Order langsung diproses otomatis."
            : "Lunas dengan saldo akun. Order langsung masuk antrean admin.",
        });
        router.push(`/app/order/${order.orderId}`);
        router.refresh();
        return;
      }
      toast.success(title, {
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
        error={serviceError}
        required
        hint="Harga mengikuti layanan yang dipilih."
      >
        <Combobox
          id="service"
          value={serviceId}
          onValueChange={(value) => {
            const nextType = services.find((s) => s.id === value)?.inputType ?? "imei";
            setExtraErrors({});
            if (nextType !== (service?.inputType ?? "imei")) {
              setImeis([]);
              setDraft("");
              setImeiError(undefined);
            }
            setServiceId(value);
            setServiceError(undefined);
          }}
          invalid={Boolean(serviceError)}
          placeholder="Pilih atau ketik nama layanan"
          options={serviceOptions}
        />
      </Field>

      {service ? (
        <div className="flex gap-2.5 rounded-md border border-hairline bg-mist px-3.5 py-3">
          <Info
            aria-hidden="true"
            weight="regular"
            className="mt-0.5 size-4 shrink-0 text-ink-soft"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <RichDescription text={service.description} />
            <p className="text-body text-ink-soft">
              Estimasi pengerjaan{" "}
              <span className="font-data tabular">{service.estimate}</span>
            </p>
          </div>
        </div>
      ) : null}

      {noDevice ? null : (
      <Field
        label={label}
        htmlFor="imei"
        error={imeiError}
        required
        hint={
          inputType === "imei"
            ? `${imeis.length}/${MAX_BULK_IMEIS} IMEI · ${
                draft.length ? `${draft.length}/${IMEI_LENGTH} digit · ` : ""
              }ketik 15 digit lalu tekan Enter untuk menambah IMEI berikutnya. Ketik *#06# pada perangkat untuk melihat IMEI.`
            : `${imeis.length}/${MAX_BULK_IMEIS} ${label} · ketik ${
                inputType === "sn" ? "Serial Number (SN)" : "ECID"
              } perangkat lalu tekan Enter untuk menambah ${label} berikutnya.`
        }
      >
        <ImeiChipInput
          id="imei"
          inputType={inputType}
          imeis={imeis}
          onImeisChange={setImeis}
          draft={draft}
          onDraftChange={setDraft}
          onError={setImeiError}
          invalid={Boolean(imeiError)}
        />
      </Field>
      )}

      {service?.requireQnt ? (
        <Field
          label="Qnt"
          htmlFor="orderQnt"
          error={extraErrors.qnt}
          required
          hint="Jumlah yang dipesan. Tidak mengubah harga."
        >
          <Input
            id="orderQnt"
            type="number"
            inputMode="numeric"
            min={1}
            max={QNT_MAX}
            step={1}
            className="font-data tabular"
            value={extras.qnt}
            invalid={Boolean(extraErrors.qnt)}
            placeholder="1"
            onChange={(event) => updateExtra("qnt", event.target.value)}
          />
        </Field>
      ) : null}

      {service?.requireUsername ? (
        <Field label="Username" htmlFor="orderUsername" error={extraErrors.username} required>
          <Input
            id="orderUsername"
            autoComplete="off"
            spellCheck={false}
            maxLength={100}
            value={extras.username}
            invalid={Boolean(extraErrors.username)}
            onChange={(event) => updateExtra("username", event.target.value)}
          />
        </Field>
      ) : null}

      {service?.requireEmail ? (
        <Field label="Email" htmlFor="orderEmail" error={extraErrors.email} required>
          <Input
            id="orderEmail"
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            maxLength={254}
            value={extras.email}
            invalid={Boolean(extraErrors.email)}
            placeholder="nama@contoh.com"
            onChange={(event) => updateExtra("email", event.target.value)}
          />
        </Field>
      ) : null}

      {ceir ? null : (
      <div
        role="note"
        className="flex gap-2.5 rounded-md border border-hold-edge bg-hold-wash px-3.5 py-3"
      >
        <Info
          aria-hidden="true"
          weight="regular"
          className="mt-0.5 size-4 shrink-0 text-hold-ink"
        />
        <p className="text-body text-hold-ink">
          Pastikan IMEI yang di-submit wajib berstatus{" "}
          <span className="font-semibold">UNKNOWN</span>. Silahkan cek Status
          IMEI melalui menu{" "}
          <Link
            href="/app/ceir/order"
            className="font-semibold underline underline-offset-2 hover:opacity-80"
          >
            Order Ceir
          </Link>
          . Apabila IMEI yang di-submit tidak berstatus{" "}
          <span className="font-semibold">UNKNOWN</span>, maka{" "}
          <span className="font-semibold">tidak ada refund</span>.
        </p>
      </div>
      )}

      {ceir ? null : (
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
      )}

      <div className="space-y-2 border-t border-hairline pt-4">
        {balanceUsed > 0 && total !== null ? (
          <>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-body text-ink-soft">
                Total
                {price !== null && quantity > 1
                  ? ` (${quantity} ${label} × ${formatRupiah(price)})`
                  : ""}
              </span>
              <DataValue>{formatRupiah(total)}</DataValue>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-body text-ink-soft">
                Dipotong saldo (saldo {formatRupiah(balance)})
              </span>
              <DataValue className="text-cleared-ink">
                −{formatRupiah(balanceUsed)}
              </DataValue>
            </div>
          </>
        ) : null}
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <span className="text-body text-ink-soft">
              {balanceUsed > 0 ? "Sisa dibayar via QRIS" : "Total yang harus dibayar"}
            </span>
            {balanceUsed === 0 && price !== null && quantity > 1 ? (
              <DataValue className="block text-body text-ink-soft">
                {quantity} {label} × {formatRupiah(price)}
              </DataValue>
            ) : null}
          </div>
          <DataValue emphasis className="text-headline">
            {due !== null ? formatRupiah(due) : "—"}
          </DataValue>
        </div>
      </div>

      <Button type="submit" block loading={submitting} loadingLabel="Membuat order">
        {paidByBalance ? (
          <Wallet className="size-4" aria-hidden="true" />
        ) : (
          <QrCode className="size-4" aria-hidden="true" />
        )}
        {paidByBalance
          ? quantity > 1
            ? `Buat ${quantity} order, bayar dengan saldo`
            : "Buat order, bayar dengan saldo"
          : quantity > 1
            ? `Buat ${quantity} order dan terbitkan 1 QRIS`
            : "Buat order dan terbitkan QRIS"}
      </Button>
    </form>
  );
}
