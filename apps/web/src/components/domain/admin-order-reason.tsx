"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { ApiError, api } from "@/lib/api";

const PRESET_REASON = "Eks Kemen / Roamer";

type Mode = "none" | "preset" | "custom";

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: "none", label: "Tidak ada keterangan" },
  { value: "preset", label: PRESET_REASON },
  { value: "custom", label: "Tulis keterangan sendiri" },
];

function modeOf(reason: string | null): Mode {
  if (!reason) return "none";
  return reason === PRESET_REASON ? "preset" : "custom";
}

/** Super Admin sets the keterangan of a rejected/cancelled order. The user is not notified. */
export function AdminOrderReason({
  orderId,
  currentReason,
}: {
  orderId: string;
  currentReason: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>(modeOf(currentReason));
  const [custom, setCustom] = React.useState(
    modeOf(currentReason) === "custom" ? (currentReason ?? "") : "",
  );
  const [saving, setSaving] = React.useState(false);

  const next =
    mode === "none" ? null : mode === "preset" ? PRESET_REASON : custom.trim() || null;
  const customMissing = mode === "custom" && !custom.trim();
  const unchanged = next === (currentReason || null);

  async function onSave() {
    setSaving(true);
    try {
      await api(`/admin/orders/${orderId}/reason`, {
        method: "PATCH",
        body: JSON.stringify({ reason: next }),
      });
      toast.success("Keterangan disimpan");
      router.refresh();
    } catch (err) {
      toast.error("Gagal menyimpan keterangan", {
        description: err instanceof ApiError ? err.message : "Coba lagi.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-hairline pt-4">
      <Field
        label="Keterangan (Super Admin)"
        htmlFor="statusReason"
        hint="Hanya tersimpan di website. User tidak diberi notifikasi."
      >
        <Select
          id="statusReason"
          value={mode}
          onValueChange={(value) => setMode(value as Mode)}
          options={MODE_OPTIONS}
        />
      </Field>
      {mode === "custom" ? (
        <Field label="Isi keterangan" htmlFor="statusReasonText">
          <Input
            id="statusReasonText"
            value={custom}
            maxLength={500}
            onChange={(event) => setCustom(event.target.value)}
            placeholder="Misalnya: IMEI sudah terdaftar"
          />
        </Field>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        loading={saving}
        loadingLabel="Menyimpan"
        onClick={() => void onSave()}
        disabled={unchanged || customMissing}
      >
        Simpan keterangan
      </Button>
    </div>
  );
}
