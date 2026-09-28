"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import {
  ArrowSquareOut,
  ArrowsClockwise,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/domain/countdown";
import { DataValue } from "@/components/ui/data-value";
import { PaymentBadge } from "@/components/ui/status-badge";
import { ApiError, api } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import type { OrderDetail } from "@/lib/types";

const PAYMENT_SIMULATION = process.env.NEXT_PUBLIC_PAYMENT_SIMULATION === "1";
const STATUS_POLL_MS = 5_000;

export function PaymentPanel({
  orderId,
  amount,
  expiresAt,
  qrPayload,
  checkoutUrl = null,
  gateway = false,
}: {
  orderId: string;
  amount: number;
  expiresAt: string;
  qrPayload: string | null;
  checkoutUrl?: string | null;
  /** Invoice issued by SayaBayar; the webhook settles it, so poll for the result. */
  gateway?: boolean;
}) {
  const router = useRouter();
  const [expired, setExpired] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  const handleExpire = React.useCallback(() => setExpired(true), []);

  const handlePaid = React.useCallback(() => {
    toast.success("Pembayaran diterima", {
      description: "Order Anda masuk antrean admin.",
    });
    router.push(`/app/order/${orderId}/status`);
    router.refresh();
  }, [orderId, router]);

  React.useEffect(() => {
    if (!gateway || expired) return;
    const timer = window.setInterval(async () => {
      if (document.hidden) return;
      try {
        const order = await api<OrderDetail>(`/orders/${orderId}`);
        if (order.status === "cancel") setExpired(true);
        else if (order.status !== "waiting_payment") handlePaid();
      } catch {
        // Transient network errors: the next tick retries.
      }
    }, STATUS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [gateway, expired, orderId, handlePaid]);

  async function handleConfirm() {
    setConfirming(true);
    try {
      const order = await api<OrderDetail>(`/orders/${orderId}/mark-paid`, {
        method: "POST",
      });
      if (order.status === "waiting_payment") {
        toast("Sedang memverifikasi pembayaran", {
          description: "Halaman ini akan diperbarui otomatis begitu pembayaran terdeteksi.",
        });
        setConfirming(false);
        return;
      }
      handlePaid();
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
          <Warning className="size-5" weight="regular" />
        </span>
        <div className="space-y-1">
          <p className="text-title text-ink">Batas waktu pembayaran habis</p>
          <p className="mx-auto max-w-[44ch] text-body text-ink-soft">
            Invoice untuk order ini sudah kedaluwarsa, sehingga order dibatalkan.
            Buat order baru untuk mendapatkan QRIS yang masih berlaku.
          </p>
        </div>
        <Button onClick={() => router.push("/app/order")}>
          <ArrowsClockwise className="size-4" weight="regular" aria-hidden="true" />
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
        {qrPayload ? (
          <div className="rounded-md border border-hairline bg-surface p-4 shadow-resting ring-1 ring-action/10">
            <QRCode
              value={qrPayload}
              size={168}
              bgColor="#FFFFFF"
              fgColor="#0F172A"
              level="M"
              aria-label="QRIS pembayaran"
            />
          </div>
        ) : null}

        {checkoutUrl ? (
          <Button asChild variant={qrPayload ? "secondary" : "primary"}>
            <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
              {qrPayload ? "Metode pembayaran lain" : "Buka halaman pembayaran"}
              <ArrowSquareOut className="size-4" weight="regular" aria-hidden="true" />
            </a>
          </Button>
        ) : null}

        <div className="text-center">
          <p className="text-label uppercase text-ink-soft">Sisa waktu</p>
          <Countdown
            expiresAt={expiresAt}
            onExpire={handleExpire}
            className="mt-1 block"
          />
        </div>

        <p className="flex max-w-[40ch] items-start gap-2 text-center text-body text-ink-soft">
          <WarningCircle
            aria-hidden="true"
            weight="regular"
            className="mt-0.5 size-4 shrink-0"
          />
          <span>
            {gateway
              ? "Bayar tepat sesuai nominal di atas. Order otomatis masuk antrean setelah pembayaran terverifikasi."
              : PAYMENT_SIMULATION
                ? "Mode simulasi: gunakan konfirmasi di bawah untuk menandai pembayaran."
                : "Order otomatis masuk antrean setelah pembayaran terverifikasi. Hubungi support bila membutuhkan bantuan."}
          </span>
        </p>
      </div>

      {gateway || PAYMENT_SIMULATION ? (
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
            {gateway
              ? "Sudah bayar? Tekan tombol ini agar pembayaran dicek lebih cepat."
              : "Setelah transfer, tekan konfirmasi agar order masuk antrean."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
