"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Tag } from "@/components/ui/status-badge";
import { ApiError, api } from "@/lib/api";

export function ChangePasswordCard({
  endpoint,
  requireTotp = false,
  loginHref = "/login",
}: {
  endpoint: string;
  requireTotp?: boolean;
  /** After password change, sessions are revoked — redirect here. */
  loginHref?: string;
}) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [totpCode, setTotpCode] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("Password baru minimal 8 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }
    setSaving(true);
    try {
      await api(endpoint, {
        method: "POST",
        body: JSON.stringify({
          currentPassword,
          newPassword,
          ...(requireTotp && totpCode ? { totpCode } : {}),
        }),
      });
      toast.success("Password diperbarui", {
        description: "Silakan login ulang dengan password baru.",
      });
      router.replace(loginHref);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Gagal mengubah password.";
      setError(message);
      toast.error("Gagal", { description: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ganti password</CardTitle>
      </CardHeader>
      <CardBody className="pt-3">
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Password saat ini" htmlFor="currentPassword" required>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </Field>
          <Field label="Password baru" htmlFor="newPassword" required>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </Field>
          <Field label="Konfirmasi password baru" htmlFor="confirmPassword" required>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </Field>
          {requireTotp ? (
            <Field
              label="Kode Authenticator"
              htmlFor="totpPw"
              hint="Diperlukan jika 2FA aktif untuk aksi ganti password."
            >
              <Input
                id="totpPw"
                inputMode="numeric"
                placeholder="000000"
                value={totpCode}
                onChange={(e) =>
                  setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </Field>
          ) : null}
          {error ? <p className="text-body text-metric-red">{error}</p> : null}
          <div className="flex justify-end">
            <Button type="submit" loading={saving} loadingLabel="Menyimpan">
              Simpan password
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export function AdminTotpCard() {
  const [enabled, setEnabled] = React.useState(false);
  const [enabledAt, setEnabledAt] = React.useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = React.useState("");
  const [secret, setSecret] = React.useState("");
  const [setupCode, setSetupCode] = React.useState("");
  const [disablePassword, setDisablePassword] = React.useState("");
  const [disableCode, setDisableCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  async function load() {
    setLoading(true);
    try {
      const status = await api<{
        enabled: boolean;
        enabledAt: string | null;
      }>("/admin/me/totp");
      setEnabled(status.enabled);
      setEnabledAt(status.enabledAt);
      setError("");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Gagal memuat status 2FA.",
      );
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
  }, []);

  async function beginSetup() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ qrDataUrl: string; secret: string }>(
        "/admin/me/totp/setup",
        { method: "POST" },
      );
      setQrDataUrl(result.qrDataUrl);
      setSecret(result.secret);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Setup gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function enable() {
    setBusy(true);
    setError("");
    try {
      await api("/admin/me/totp/enable", {
        method: "POST",
        body: JSON.stringify({ code: setupCode }),
      });
      toast.success("2FA diaktifkan");
      setQrDataUrl("");
      setSecret("");
      setSetupCode("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Aktivasi gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function disable(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/admin/me/totp/disable", {
        method: "POST",
        body: JSON.stringify({
          password: disablePassword,
          code: disableCode,
        }),
      });
      toast.success("2FA dinonaktifkan");
      setDisablePassword("");
      setDisableCode("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nonaktifkan gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Google Authenticator (2FA)</CardTitle>
          <Tag className={enabled ? "bg-cleared-wash text-cleared-ink" : undefined}>
            {enabled ? "Aktif" : "Nonaktif"}
          </Tag>
        </div>
      </CardHeader>
      <CardBody className="space-y-4 pt-3">
        {loading ? (
          <p className="text-body text-ink-soft">Memuat status…</p>
        ) : null}

        {!loading && !enabled && !qrDataUrl ? (
          <div className="space-y-3">
            <p className="text-body text-ink-soft">
              Lindungi login Super Admin dengan kode sekali pakai dari Google
              Authenticator.
            </p>
            <Button type="button" onClick={beginSetup} loading={busy}>
              Mulai setup 2FA
            </Button>
          </div>
        ) : null}

        {qrDataUrl ? (
          <div className="space-y-4">
            <p className="text-body text-ink-soft">
              Pindai QR berikut di Google Authenticator, lalu masukkan kode 6
              digit untuk mengaktifkan.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="QR code Google Authenticator"
              className="size-44 rounded-lg border border-hairline bg-surface p-2"
            />
            <p className="font-data text-body text-ink-soft break-all">
              Secret: {secret}
            </p>
            <Field label="Kode verifikasi" htmlFor="setupCode" required>
              <Input
                id="setupCode"
                inputMode="numeric"
                placeholder="000000"
                value={setupCode}
                onChange={(e) =>
                  setSetupCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </Field>
            <Button type="button" onClick={enable} loading={busy}>
              Aktifkan 2FA
            </Button>
          </div>
        ) : null}

        {enabled ? (
          <form onSubmit={disable} className="space-y-4">
            <p className="text-body text-ink-soft">
              2FA aktif
              {enabledAt
                ? ` sejak ${new Date(enabledAt).toLocaleString("id-ID")}`
                : ""}
              . Nonaktifkan memerlukan password dan kode authenticator.
            </p>
            <Field label="Password" htmlFor="disablePassword" required>
              <Input
                id="disablePassword"
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
              />
            </Field>
            <Field label="Kode Authenticator" htmlFor="disableCode" required>
              <Input
                id="disableCode"
                inputMode="numeric"
                placeholder="000000"
                value={disableCode}
                onChange={(e) =>
                  setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </Field>
            <Button type="submit" variant="danger" loading={busy}>
              Nonaktifkan 2FA
            </Button>
          </form>
        ) : null}

        {error ? <p className="text-body text-metric-red">{error}</p> : null}
      </CardBody>
    </Card>
  );
}
