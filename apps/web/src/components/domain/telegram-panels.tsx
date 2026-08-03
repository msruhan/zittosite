"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Tag } from "@/components/ui/status-badge";
import { ApiError, api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

export type TelegramStatus = {
  oauthLinked: boolean;
  chatLinked: boolean;
  username: string | null;
  oauthLinkedAt: string | null;
  linkedAt: string | null;
};

export function TelegramLinkCard({
  statusEndpoint,
  startEndpoint,
  unlinkEndpoint,
  requireTotp = false,
  portalHint,
}: {
  statusEndpoint: string;
  startEndpoint: string;
  unlinkEndpoint: string;
  requireTotp?: boolean;
  portalHint: string;
}) {
  const [status, setStatus] = React.useState<TelegramStatus | null>(null);
  const [totpCode, setTotpCode] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  async function load() {
    setLoading(true);
    try {
      const next = await api<TelegramStatus>(statusEndpoint);
      setStatus(next);
      setError("");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Gagal memuat status Telegram.",
      );
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
  }, [statusEndpoint]);

  async function startLink() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ authorizationUrl: string }>(startEndpoint, {
        method: "POST",
        body: JSON.stringify(
          requireTotp ? { totpCode } : {},
        ),
      });
      window.location.assign(result.authorizationUrl);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Gagal memulai tautan Telegram.";
      setError(message);
      toast.error("Gagal", { description: message });
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    setError("");
    try {
      await api(unlinkEndpoint, { method: "DELETE" });
      toast.success("Telegram dilepas");
      setTotpCode("");
      await load();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Gagal melepas tautan.";
      setError(message);
      toast.error("Gagal", { description: message });
    } finally {
      setBusy(false);
    }
  }

  const linked = Boolean(status?.chatLinked);
  const oauthOnly = Boolean(status?.oauthLinked && !status?.chatLinked);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="size-4 text-action" aria-hidden="true" />
          Telegram
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-4 pt-3">
        <p className="text-body text-ink-soft">{portalHint}</p>

        {loading ? (
          <p className="text-body text-ink-faint">Memuat status…</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {linked ? (
              <Tag className="border-cleared-edge bg-cleared-wash text-cleared-ink">
                Tertaut
              </Tag>
            ) : oauthOnly ? (
              <Tag className="border-transparent bg-hold-wash text-hold-ink">
                OAuth OK — aktivasi chat
              </Tag>
            ) : (
              <Tag>Belum tertaut</Tag>
            )}
            {status?.username ? (
              <span className="text-body font-medium text-ink">
                {status.username}
              </span>
            ) : null}
          </div>
        )}

        {status?.linkedAt ? (
          <p className="text-label text-ink-faint">
            Chat diverifikasi {formatDateTime(status.linkedAt)}
          </p>
        ) : status?.oauthLinkedAt ? (
          <p className="text-label text-ink-faint">
            OAuth {formatDateTime(status.oauthLinkedAt)} — buka bot untuk
            mengaktifkan chat.
          </p>
        ) : null}

        {requireTotp && !linked ? (
          <Field
            label="Kode Authenticator"
            htmlFor="tgTotp"
            hint="Wajib sebelum menautkan Telegram Admin."
          >
            <Input
              id="tgTotp"
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

        <div className="flex flex-wrap justify-end gap-2">
          {linked || oauthOnly ? (
            <Button
              type="button"
              variant="outline"
              loading={busy}
              loadingLabel="Memproses"
              onClick={() => void unlink()}
            >
              Lepas tautan
            </Button>
          ) : null}
          {!linked ? (
            <Button
              type="button"
              loading={busy}
              loadingLabel="Mengalihkan"
              onClick={() => void startLink()}
              disabled={requireTotp && totpCode.length !== 6}
            >
              Tautkan Telegram
            </Button>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

export function TelegramBotCenterPanel() {
  return (
    <TelegramLinkCard
      statusEndpoint="/me/telegram/status"
      startEndpoint="/me/telegram/oauth/start"
      unlinkEndpoint="/me/telegram"
      portalHint="Tautkan akun Telegram pribadi untuk /status dan /saldo di bot ZITTOSITE. Alur: OAuth → buka bot → chat terverifikasi."
    />
  );
}

export function AdminTelegramPanel() {
  return (
    <TelegramLinkCard
      statusEndpoint="/admin/settings/telegram"
      startEndpoint="/admin/settings/telegram/oauth/start"
      unlinkEndpoint="/admin/settings/telegram"
      requireTotp
      portalHint="Tautkan Telegram Admin untuk menerima notifikasi (user baru / order baru). Wajib aktifkan Google Authenticator terlebih dahulu."
    />
  );
}
