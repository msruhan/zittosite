"use client";

import * as React from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowClockwise,
  ArrowRight,
  BookOpenText,
  Check,
  Copy,
  Key,
  PaperPlaneTilt,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Tag } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import { ApiError, api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { ApiKey, WebhookDelivery, WebhookEndpoint } from "@/lib/types";

function errorText(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Tidak dapat menyalin", { description: "Salin secara manual." });
    }
  }
  return (
    <Button type="button" size="sm" variant="outline" onClick={copy} aria-label={`Salin ${label}`}>
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {copied ? "Tersalin" : "Salin"}
    </Button>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-label uppercase text-ink-soft">{label}</p>
        <p className="break-all font-data text-body text-ink">{value}</p>
      </div>
      <CopyButton value={value} label={label} />
    </div>
  );
}

/** Shows a secret exactly once; closing the dialog discards it. */
function SecretDialog({
  title,
  description,
  secret,
  onClose,
}: {
  title: string;
  description: string;
  secret: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={secret !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={title}
        description={description}
        footer={
          <Button type="button" onClick={onClose}>
            Saya sudah menyimpannya
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="break-all rounded-md border border-hairline bg-mist px-3 py-2.5 font-data text-body text-ink">
            {secret}
          </p>
          {secret ? <CopyButton value={secret} label={title} /> : null}
          <p className="text-body text-hold-ink">
            Nilai ini hanya ditampilkan sekali. Jika hilang, buat yang baru.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ApiConnectionCard({ endpoint, username }: { endpoint: string; username: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Koneksi API</CardTitle>
        <CardDescription>
          Masukkan data ini di panel reseller atau website Anda sebagai supplier API.
        </CardDescription>
      </CardHeader>
      <CardBody className="divide-y divide-hairline pt-1">
        <CopyRow label="API URL" value={endpoint} />
        <CopyRow label="Username" value={username} />
        <div className="py-2.5">
          <p className="text-label uppercase text-ink-soft">API access key</p>
          <p className="text-body text-ink-soft">
            Buat di bagian API Key di bawah. Pembayaran order memakai saldo akun Anda.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

export function ApiKeysPanel({ initialKeys }: { initialKeys: ApiKey[] }) {
  const [keys, setKeys] = React.useState(initialKeys);
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [created, setCreated] = React.useState<string | null>(null);
  const [revoking, setRevoking] = React.useState<ApiKey | null>(null);

  async function reload() {
    const next = await api<{ keys: ApiKey[] }>("/api-keys");
    setKeys(next.keys);
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const result = await api<ApiKey & { key: string }>("/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      setCreated(result.key);
      setName("");
      await reload();
    } catch (err) {
      toast.error("Gagal membuat API key", { description: errorText(err, "Coba lagi.") });
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(key: ApiKey) {
    try {
      await api(`/api-keys/${key.id}`, { method: "DELETE" });
      await reload();
      toast.success("API key dicabut", {
        description: `Request dengan key "${key.name}" sekarang ditolak.`,
      });
    } catch (err) {
      toast.error("Gagal mencabut key", { description: errorText(err, "Coba lagi.") });
    } finally {
      setRevoking(null);
    }
  }

  const active = keys.filter((key) => !key.revokedAt);
  const revoked = keys.filter((key) => key.revokedAt);

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Key</CardTitle>
        <CardDescription>Maksimal 5 key aktif. Satu key per website memudahkan pencabutan.</CardDescription>
      </CardHeader>
      <CardBody className="space-y-4 pt-3">
        <form onSubmit={handleCreate} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Field label="Nama key" htmlFor="api-key-name" className="flex-1">
            <Input
              id="api-key-name"
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              placeholder="Contoh: Website utama"
            />
          </Field>
          <Button type="submit" disabled={busy || !name.trim() || active.length >= 5}>
            <Plus aria-hidden="true" />
            Buat key
          </Button>
        </form>

        {keys.length ? (
          <ul className="divide-y divide-hairline border-t border-hairline">
            {[...active, ...revoked].map((key) => (
              <li key={key.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 text-body font-medium text-ink">
                    <Key className="size-4 text-ink-soft" aria-hidden="true" />
                    {key.name}
                    {key.revokedAt ? (
                      <Tag className="border-refused-edge bg-refused-wash text-refused-ink">Dicabut</Tag>
                    ) : (
                      <Tag className="border-cleared-edge bg-cleared-wash text-cleared-ink">Aktif</Tag>
                    )}
                  </p>
                  <p className="font-data text-body text-ink-soft">
                    {key.prefix}… · dibuat {formatDateTime(key.createdAt)}
                    {key.lastUsedAt ? ` · dipakai ${formatDateTime(key.lastUsedAt)}` : " · belum dipakai"}
                  </p>
                </div>
                {key.revokedAt ? null : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRevoking(key)}
                    aria-label={`Cabut key ${key.name}`}
                  >
                    <Trash aria-hidden="true" />
                    Cabut
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-soft">Belum ada API key.</p>
        )}
      </CardBody>

      <SecretDialog
        title="API key baru"
        description="Pakai sebagai apiaccesskey bersama username Anda."
        secret={created}
        onClose={() => setCreated(null)}
      />

      <Dialog open={revoking !== null} onOpenChange={(open) => !open && setRevoking(null)}>
        <DialogContent
          title="Cabut API key?"
          description={`Website yang memakai key "${revoking?.name ?? ""}" tidak bisa order lagi. Tindakan ini tidak bisa dibatalkan.`}
          footer={
            <>
              <Button variant="outline" onClick={() => setRevoking(null)}>
                Batal
              </Button>
              <Button variant="danger" onClick={() => revoking && handleRevoke(revoking)}>
                Cabut key
              </Button>
            </>
          }
        >
          <p className="font-data text-body text-ink-soft">{revoking?.prefix}…</p>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

const DELIVERY_TONE: Record<WebhookDelivery["status"], string> = {
  pending: "border-hold-edge bg-hold-wash text-hold-ink",
  success: "border-cleared-edge bg-cleared-wash text-cleared-ink",
  failed: "border-refused-edge bg-refused-wash text-refused-ink",
};

const DELIVERY_LABEL: Record<WebhookDelivery["status"], string> = {
  pending: "Menunggu",
  success: "Terkirim",
  failed: "Gagal",
};

export function WebhookPanel({
  initialEndpoint,
  initialDeliveries,
}: {
  initialEndpoint: WebhookEndpoint | null;
  initialDeliveries: WebhookDelivery[];
}) {
  const [endpoint, setEndpoint] = React.useState(initialEndpoint);
  const [deliveries, setDeliveries] = React.useState(initialDeliveries);
  const [url, setUrl] = React.useState(initialEndpoint?.url ?? "");
  const [busy, setBusy] = React.useState(false);
  const [secret, setSecret] = React.useState<string | null>(null);

  async function reloadDeliveries() {
    setDeliveries(await api<WebhookDelivery[]>("/webhook/deliveries"));
  }

  async function save(input: { url?: string; isActive?: boolean }) {
    setBusy(true);
    try {
      const result = await api<{ endpoint: WebhookEndpoint; secret: string | null }>("/webhook", {
        method: "PUT",
        body: JSON.stringify(input),
      });
      setEndpoint(result.endpoint);
      setUrl(result.endpoint.url);
      if (result.secret) setSecret(result.secret);
      toast.success("Webhook disimpan");
    } catch (err) {
      toast.error("Gagal menyimpan webhook", { description: errorText(err, "Coba lagi.") });
    } finally {
      setBusy(false);
    }
  }

  async function rotate() {
    setBusy(true);
    try {
      const result = await api<{ secret: string }>("/webhook/secret", { method: "POST" });
      setSecret(result.secret);
    } catch (err) {
      toast.error("Gagal membuat secret", { description: errorText(err, "Coba lagi.") });
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const result = await api<{ ok: boolean; status: number | null; error: string | null }>(
        "/webhook/test",
        { method: "POST" },
      );
      if (result.ok) {
        toast.success("Webhook merespons", { description: `HTTP ${result.status}` });
      } else {
        toast.error("Webhook gagal", { description: result.error ?? "Tidak ada respons." });
      }
    } catch (err) {
      toast.error("Gagal mengirim test", { description: errorText(err, "Coba lagi.") });
    } finally {
      setBusy(false);
    }
  }

  const paused = endpoint && !endpoint.isActive && endpoint.failureCount >= 10;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhook</CardTitle>
        <CardDescription>
          Kami kirim POST bertanda tangan ke URL ini saat order API selesai, ditolak, atau dibatalkan.
        </CardDescription>
      </CardHeader>
      <CardBody className="space-y-4 pt-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save({ url: url.trim() });
          }}
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
        >
          <Field label="URL webhook (https)" htmlFor="webhook-url" className="flex-1">
            <Input
              id="webhook-url"
              type="url"
              value={url}
              maxLength={500}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://website-anda.com/webhook/order"
            />
          </Field>
          <Button type="submit" disabled={busy || !url.trim() || url.trim() === endpoint?.url}>
            Simpan
          </Button>
        </form>

        {endpoint ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-hairline px-3 py-2.5">
              <div className="flex items-center gap-3">
                <Switch
                  checked={endpoint.isActive}
                  disabled={busy}
                  ariaLabel="Aktifkan webhook"
                  onCheckedChange={(checked) => void save({ isActive: checked })}
                />
                <div>
                  <p className="text-body font-medium text-ink">
                    {endpoint.isActive ? "Aktif" : paused ? "Dijeda otomatis" : "Nonaktif"}
                  </p>
                  <p className="text-body text-ink-soft">
                    {paused
                      ? "Dijeda setelah 10 kali gagal berturut-turut. Perbaiki URL lalu aktifkan lagi."
                      : endpoint.lastDeliveryAt
                        ? `Terakhir ${endpoint.lastStatus === "success" ? "berhasil" : "gagal"} ${formatDateTime(endpoint.lastDeliveryAt)}`
                        : "Belum ada pengiriman."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={test}>
                  <PaperPlaneTilt aria-hidden="true" />
                  Kirim test
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={rotate}>
                  <ArrowClockwise aria-hidden="true" />
                  Buat ulang secret
                </Button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-body font-medium text-ink">Pengiriman terakhir</p>
                <Button size="sm" variant="ghost" onClick={() => void reloadDeliveries()}>
                  <ArrowClockwise aria-hidden="true" />
                  Muat ulang
                </Button>
              </div>
              {deliveries.length ? (
                <ul className="mt-2 divide-y divide-hairline border-t border-hairline">
                  {deliveries.map((delivery) => (
                    <li key={delivery.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="font-data text-body text-ink">
                          {delivery.orderId} · {delivery.event}
                        </p>
                        <p className="text-body text-ink-soft">
                          {`${formatDateTime(delivery.updatedAt)} · ${delivery.attempts}x percobaan`}
                          {delivery.responseCode
                            ? ` · HTTP ${delivery.responseCode}`
                            : delivery.lastError
                              ? ` · ${delivery.lastError}`
                              : ""}
                        </p>
                      </div>
                      <Tag className={DELIVERY_TONE[delivery.status]}>{DELIVERY_LABEL[delivery.status]}</Tag>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-body text-ink-soft">Belum ada pengiriman.</p>
              )}
            </div>
          </>
        ) : null}
      </CardBody>

      <SecretDialog
        title="Secret webhook"
        description="Pakai untuk memverifikasi header X-Signature di server Anda."
        secret={secret}
        onClose={() => setSecret(null)}
      />
    </Card>
  );
}

export function ApiDocsLinkCard() {
  return (
    <Card>
      <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-action-wash text-action">
            <BookOpenText className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-title text-ink">Dokumentasi API</p>
            <p className="text-body text-ink-soft">
              Semua action, contoh kode cURL, PHP, dan Node.js, webhook, kode status, dan daftar error.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/docs">
            Buka dokumentasi
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </CardBody>
    </Card>
  );
}
