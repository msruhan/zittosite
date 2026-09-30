"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";

/** Two-step cancel: the first press asks, the second one cancels. */
export function CancelOrderButton({
  orderId,
  bulkCount = 1,
}: {
  orderId: string;
  /** Unpaid orders sharing this QRIS; cancelling one cancels them all. */
  bulkCount?: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function handleCancel() {
    setBusy(true);
    try {
      await api(`/orders/${orderId}/cancel`, { method: "POST" });
      toast.success("Order dibatalkan", {
        description: "Anda bisa membuat order baru sekarang.",
      });
      router.push(`/app/order/${orderId}`);
      router.refresh();
    } catch (err) {
      toast.error("Gagal membatalkan", {
        description:
          err instanceof ApiError ? err.message : "Coba lagi beberapa saat.",
      });
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="ghost" block onClick={() => setConfirming(true)}>
        {bulkCount > 1 ? `Batalkan semua (${bulkCount} order)` : "Batalkan order"}
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-center text-body text-ink-soft">
        {bulkCount > 1
          ? `Semua ${bulkCount} order di bulk ini ikut dibatalkan karena memakai 1 QRIS.`
          : `Batalkan order ${orderId}? QRIS-nya tidak bisa dipakai lagi.`}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          onClick={() => setConfirming(false)}
          disabled={busy}
        >
          Tidak
        </Button>
        <Button
          variant="danger"
          onClick={handleCancel}
          loading={busy}
          loadingLabel="Membatalkan"
        >
          Ya, batalkan
        </Button>
      </div>
    </div>
  );
}
