"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";

/** Two-step cancel: the first press asks, the second one cancels. */
export function CancelTopupButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function handleCancel() {
    setBusy(true);
    try {
      await api(`/topups/${invoiceId}/cancel`, { method: "POST" });
      toast.success("Topup dibatalkan");
      router.push("/app/topup");
      router.refresh();
    } catch (err) {
      toast.error("Gagal membatalkan", {
        description: err instanceof ApiError ? err.message : "Coba lagi beberapa saat.",
      });
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="ghost" block onClick={() => setConfirming(true)}>
        Batalkan topup
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-center text-body text-ink-soft">
        Batalkan topup {invoiceId}? QRIS-nya tidak bisa dipakai lagi.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
          Tidak
        </Button>
        <Button
          variant="danger"
          onClick={() => void handleCancel()}
          loading={busy}
          loadingLabel="Membatalkan"
        >
          Ya, batalkan
        </Button>
      </div>
    </div>
  );
}
