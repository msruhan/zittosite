"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Gateway = "sayabayar" | "listener";

type PaymentStatus = {
  gateway: Gateway;
  sayabayar: { configured: boolean };
  listener: {
    qrisConfigured: boolean;
    qris: string | null;
    merchantName: string | null;
    session: {
      connected: boolean;
      dead: boolean;
      deadReason: string | null;
      merchantName: string | null;
      phoneMasked: string | null;
      pendingOtp: { phoneMasked: string; expiresAt: string } | null;
    };
    poller: {
      lastSuccessAt: string | null;
      lastError: string | null;
      consecutiveFailures: number;
    };
  };
};

const OPTIONS: Array<{ id: Gateway; title: string; body: string }> = [
  {
    id: "sayabayar",
    title: "Saya Bayar",
    body: "QRIS dibuat oleh Sayabayar. Pembayaran masuk lewat webhook invoice.",
  },
  {
    id: "listener",
    title: "Listener VPS",
    body: "QRIS dibuat dari QR merchant sendiri. Pembayaran dicocokkan dari feed GoBiz di server.",
  },
];

export function PaymentGatewaySettings() {
  const [status, setStatus] = React.useState<PaymentStatus | null>(null);
  const [qris, setQris] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const next = await api<PaymentStatus>("/admin/payments");
    setStatus(next);
    setQris(next.listener.qris ?? "");
  }, []);

  React.useEffect(() => {
    void load().catch((err: unknown) => {
      toast.error(err instanceof ApiError ? err.message : "Status pembayaran gagal dimuat.");
    });
  }, [load]);

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    try {
      await action();
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Permintaan gagal.");
    } finally {
      setBusy(null);
    }
  }

  if (!status) {
    return <p className="text-body text-ink-soft">Memuat pengaturan pembayaran…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const active = status.gateway === option.id;
          return (
            <button
              key={option.id}
              type="button"
              disabled={busy === "gateway"}
              onClick={() =>
                run("gateway", async () => {
                  await api("/admin/payments/gateway", {
                    method: "PUT",
                    body: JSON.stringify({ gateway: option.id }),
                  });
                  toast.success(`${option.title} dipakai untuk invoice baru.`);
                })
              }
              className={cn(
                "rounded-xl border px-4 py-4 text-left transition-colors",
                active
                  ? "border-action bg-action-wash"
                  : "border-hairline bg-surface hover:border-ink-faint",
              )}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-body font-bold text-ink">{option.title}</span>
                <span className={cn("text-label", active ? "text-action" : "text-ink-soft")}>
                  {active ? "Aktif" : "Pilih"}
                </span>
              </span>
              <span className="mt-2 block text-body text-ink-soft">{option.body}</span>
            </button>
          );
        })}
      </div>

      {status.gateway === "sayabayar" ? (
        <Card>
          <CardHeader>
            <CardTitle>Saya Bayar</CardTitle>
          </CardHeader>
          <CardBody className="pt-3">
            <p className="text-body text-ink-soft">
              {status.sayabayar.configured
                ? "API key Sayabayar terbaca di server. Invoice baru memakai gateway ini."
                : "API key Sayabayar belum diisi di server, jadi invoice baru tidak bisa dibuat."}
            </p>
          </CardBody>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>QRIS merchant</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4 pt-3">
              <Field
                label="QRIS statis"
                htmlFor="qrisStatic"
                hint={
                  status.listener.merchantName
                    ? `Merchant di QR: ${status.listener.merchantName}. Nominal unik ditambahkan otomatis per invoice.`
                    : "Tempel payload QR statis dari GoBiz. Jangan memakai QR dinamis."
                }
              >
                <Textarea
                  id="qrisStatic"
                  rows={4}
                  value={qris}
                  className="font-data text-xs"
                  onChange={(event) => setQris(event.target.value)}
                />
              </Field>
              <div className="flex justify-end">
                <Button
                  type="button"
                  loading={busy === "qris"}
                  loadingLabel="Menyimpan"
                  onClick={() =>
                    run("qris", async () => {
                      await api("/admin/payments/qris", {
                        method: "PUT",
                        body: JSON.stringify({ payload: qris }),
                      });
                      toast.success("QRIS statis disimpan.");
                    })
                  }
                >
                  Simpan QRIS
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sesi GoBiz</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4 pt-3">
              <p className="text-body text-ink-soft">
                {status.listener.session.connected
                  ? `Terhubung${status.listener.session.merchantName ? ` ke ${status.listener.session.merchantName}` : ""}${status.listener.session.phoneMasked ? ` · ${status.listener.session.phoneMasked}` : ""}. Pembayaran pending dicek tiap 20 detik.`
                  : status.listener.session.dead
                    ? `Sesi putus${status.listener.session.deadReason ? `: ${status.listener.session.deadReason}` : ""}. Masukkan OTP lagi.`
                    : "Belum terhubung. Minta OTP ke nomor merchant GoBiz."}
              </p>
              {status.listener.poller.lastError ? (
                <p className="text-body text-refused-ink">
                  Pemeriksaan terakhir gagal: {status.listener.poller.lastError}
                </p>
              ) : null}
              <Field label="Nomor HP merchant" htmlFor="gobizPhone">
                <Input
                  id="gobizPhone"
                  inputMode="tel"
                  value={phone}
                  placeholder="08…"
                  onChange={(event) => setPhone(event.target.value)}
                />
              </Field>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  loading={busy === "otp"}
                  loadingLabel="Mengirim"
                  onClick={() =>
                    run("otp", async () => {
                      await api("/admin/payments/gobiz/otp", {
                        method: "POST",
                        body: JSON.stringify({ phone }),
                      });
                      toast.success("OTP dikirim.");
                    })
                  }
                >
                  Kirim OTP
                </Button>
                {status.listener.session.connected ? (
                  <Button
                    type="button"
                    variant="outline"
                    loading={busy === "disconnect"}
                    loadingLabel="Memutus"
                    onClick={() =>
                      run("disconnect", async () => {
                        await api("/admin/payments/gobiz/disconnect", { method: "POST" });
                        toast.success("Sesi GoBiz diputus.");
                      })
                    }
                  >
                    Putuskan
                  </Button>
                ) : null}
              </div>
              {status.listener.session.pendingOtp ? (
                <>
                  <Field
                    label="Kode OTP"
                    htmlFor="gobizOtp"
                    hint={`Dikirim ke ${status.listener.session.pendingOtp.phoneMasked}.`}
                  >
                    <Input
                      id="gobizOtp"
                      inputMode="numeric"
                      value={otp}
                      onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                    />
                  </Field>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      loading={busy === "verify"}
                      loadingLabel="Memeriksa"
                      onClick={() =>
                        run("verify", async () => {
                          await api("/admin/payments/gobiz/verify", {
                            method: "POST",
                            body: JSON.stringify({ otp }),
                          });
                          setOtp("");
                          toast.success("GoBiz terhubung.");
                        })
                      }
                    >
                      Hubungkan
                    </Button>
                  </div>
                </>
              ) : null}
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  loading={busy === "poll"}
                  loadingLabel="Memeriksa"
                  onClick={() =>
                    run("poll", async () => {
                      const result = await api<{ processed: number }>("/admin/payments/gobiz/poll", {
                        method: "POST",
                      });
                      toast.success(
                        result.processed
                          ? `${result.processed} transaksi baru diperiksa.`
                          : "Tidak ada transaksi baru.",
                      );
                    })
                  }
                >
                  Cek transaksi sekarang
                </Button>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
