"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ApiError, api } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Topup } from "@/lib/types";

const PRESETS = [50_000, 100_000, 250_000, 500_000];
const MIN = 10_000;
const MAX = 5_000_000;

export function TopupForm() {
  const router = useRouter();
  const [preset, setPreset] = React.useState<number | null>(100_000);
  const [custom, setCustom] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const customValue = Number(custom.replace(/\D/g, "")) || 0;
  const amount = preset ?? customValue;
  const invalid = preset === null && (customValue < MIN || customValue > MAX);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (invalid || !amount) return;
    setBusy(true);
    try {
      const topup = await api<Topup>("/topups", {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
      router.push(`/app/topup/${topup.invoiceId}`);
    } catch (err) {
      toast.error("Gagal membuat topup", {
        description: err instanceof ApiError ? err.message : "Coba lagi beberapa saat.",
      });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <fieldset>
        <legend className="text-body font-medium text-ink">Pilih nominal</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {PRESETS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={preset === value}
              onClick={() => {
                setPreset(value);
                setCustom("");
              }}
              className={cn(
                "h-12 rounded-md border font-data text-body tabular transition-colors duration-150 ease-out-strong",
                preset === value
                  ? "border-action bg-action-wash font-semibold text-action"
                  : "border-hairline bg-surface text-ink hover:border-ink-faint hover:bg-mist",
              )}
            >
              {formatRupiah(value)}
            </button>
          ))}
        </div>
      </fieldset>

      <Field
        label="Atau isi nominal sendiri"
        htmlFor="topupCustom"
        hint={`Minimal ${formatRupiah(MIN)}, maksimal ${formatRupiah(MAX)}.`}
        error={
          preset === null && custom && invalid
            ? `Nominal harus antara ${formatRupiah(MIN)} dan ${formatRupiah(MAX)}.`
            : undefined
        }
      >
        <Input
          id="topupCustom"
          inputMode="numeric"
          placeholder="Misalnya 150000"
          value={custom}
          invalid={preset === null && Boolean(custom) && invalid}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 7);
            setCustom(digits ? Number(digits).toLocaleString("id-ID") : "");
            setPreset(null);
          }}
        />
      </Field>

      <Button
        type="submit"
        block
        loading={busy}
        loadingLabel="Membuat QRIS"
        disabled={invalid || !amount}
      >
        {amount && !invalid ? `Topup ${formatRupiah(amount)}` : "Topup"}
      </Button>
    </form>
  );
}
