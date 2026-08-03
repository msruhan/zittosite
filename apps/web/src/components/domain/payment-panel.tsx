"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import { CircleAlert, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/domain/countdown";
import { DataValue } from "@/components/ui/data-value";
import { PaymentBadge } from "@/components/ui/status-badge";
import { ApiError, api } from "@/lib/api";
import { formatRupiah } from "@/lib/format";

export function PaymentPanel({
  orderId,
  amount,
  expiresAt,
  qrPayload,
}: {
  orderId: string;
  amount: number;
  expiresAt: string;
  qrPayload: string;
}) {
  const router = useRouter();
  const [expired, setExpired] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  const handleExpire = React.useCallback(() => setExpired(true), []);

  async function handleConfirm() {
    setConfirming(true);
    try {
      await api(`/orders/${orderId}/mark-paid`, { method: "POST" });
      toast.success("Pembayaran diterima", {
        description: "Order Anda masuk antrean admin.",
      });
      router.push(`/app/order/${orderId}/status`);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Gagal mengonfirmasi pembayaran.";
      toast.error("Gagal", { description: message });
      setConfirming(false);
    }
  }

  if (expired) {
    return (
      <div className="flex flex-col items-center gap-4 px-5 py-10 text-center">
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-full bg-void-wash text-void-ink"
        >
          <TriangleAlert className="size-5" strokeWidth={1.5} />
        </span>
        <div className="space-y-1">
          <p className="text-title text-ink">Batas waktu pembayaran habis</p>
          <p className="mx-auto max-w-[44ch] text-body text-ink-soft">
            Invoice untuk order ini sudah kedaluwarsa, sehingga order dibatalkan.
            Buat order baru untuk mendapatkan QRIS yang masih berlaku.
          </p>
        </div>
        <Button onClick={() => router.push("/app/order")}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Buat order baru
        </Button>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-label uppercase text-ink-soft">Jumlah bayar</p>
          <DataValue emphasis className="mt-1 block text-display">
            {formatRupiah(amount)}
          </DataValue>
        </div>
        <PaymentBadge status="pending" />
      </div>

      <div className="mt-5 flex flex-col items-center gap-4 rounded-lg border border-hairline bg-mist px-4 py-6">
        <div className="rounded-md border border-hairline bg-surface p-4 shadow-resting ring-1 ring-action/10">
          <QRCode
            value={qrPayload}
            size={168}
            bgColor="#FFFFFF"
            fgColor="#0F172A"
            level="M"
            aria-hidden="true"
          />
        </div>

        <div className="text-center">
          <p className="text-label uppercase text-ink-soft">Sisa waktu</p>
          <Countdown
            expiresAt={expiresAt}
            onExpire={handleExpire}
            className="mt-1 block"
          />
        </div>

        <p className="flex max-w-[40ch] items-start gap-2 text-center text-body text-ink-soft">
          <CircleAlert
            aria-hidden="true"
            strokeWidth={1.5}
            className="mt-0.5 size-4 shrink-0"
          />
          <span>
            Pembayaran otomatis belum aktif. Gunakan konfirmasi di bawah setelah
            transfer selesai, atau hubungi support bila membutuhkan bantuan.
          </span>
        </p>
      </div>

      <div className="mt-5 space-y-2">
        <Button
          block
          variant="secondary"
          onClick={handleConfirm}
          loading={confirming}
          loadingLabel="Memeriksa pembayaran"
        >
          Saya sudah bayar
        </Button>
        <p className="text-center text-body text-ink-soft">
          Setelah transfer, tekan konfirmasi agar order masuk antrean.
        </p>
      </div>
    </div>
  );
}
