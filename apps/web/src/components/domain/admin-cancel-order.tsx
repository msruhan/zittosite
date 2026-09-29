"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ApiError, api } from "@/lib/api";

/** Super Admin cancel: closes the invoice, updates Telegram cards, and notifies the user. */
export function AdminCancelOrder({
  orderId,
  paid,
}: {
  orderId: string;
  paid: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function handleCancel() {
    setBusy(true);
    try {
      await api(`/admin/orders/${orderId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      toast.success("Order dibatalkan", {
        description: "User sudah diberi tahu lewat Telegram.",
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error("Gagal membatalkan", {
        description: err instanceof ApiError ? err.message : "Coba lagi.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="border-t border-hairline pt-4">
        <Button variant="outline" onClick={() => setOpen(true)}>
          Batalkan order
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-hairline pt-4">
      <Field
        label="Alasan pembatalan"
        htmlFor="cancelReason"
        hint="Dikirim ke user. Boleh dikosongkan."
      >
        <Input
          id="cancelReason"
          value={reason}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Misalnya: IMEI tidak valid"
        />
      </Field>
      {paid ? (
        <p className="text-body text-refused-ink">
          Order ini sudah dibayar. Setelah dibatalkan, pengembalian dana harus
          diproses manual.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="danger"
          onClick={() => void handleCancel()}
          loading={busy}
          loadingLabel="Membatalkan"
        >
          Ya, batalkan order
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          Tidak
        </Button>
      </div>
    </div>
  );
}
