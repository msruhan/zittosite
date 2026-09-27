"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

type CompleteResult = {
  botUrl: string;
  expiresAt: string;
};

export default function TelegramOauthCallbackPage() {
  return (
    <React.Suspense fallback={null}>
      <TelegramOauthCallback />
    </React.Suspense>
  );
}

function TelegramOauthCallback() {
  const query = useSearchParams();
  const code = query.get("code") ?? "";
  const state = query.get("state") ?? "";
  const oauthError = query.get("error_description") ?? query.get("error");
  const actor: "user" | "admin" = state.startsWith("a_") ? "admin" : "user";

  const started = React.useRef(false);
  const [result, setResult] = React.useState<CompleteResult | null>(null);
  const [activated, setActivated] = React.useState(false);
  const [requestError, setRequestError] = React.useState("");
  const error = oauthError
    ? `Telegram membatalkan OAuth: ${oauthError}`
    : requestError;

  React.useEffect(() => {
    if (started.current || oauthError) return;
    started.current = true;
    api<CompleteResult>(
      actor === "admin"
        ? "/admin/settings/telegram/oauth/complete"
        : "/me/telegram/oauth/complete",
      {
        method: "POST",
        body: JSON.stringify({ code, state }),
      },
    )
      .then(setResult)
      .catch((reason: unknown) => {
        setRequestError(
          reason instanceof ApiError
            ? reason.message
            : "Gagal memverifikasi OAuth Telegram",
        );
      });
  }, [actor, code, oauthError, state]);

  React.useEffect(() => {
    if (!result || activated) return;
    const path =
      actor === "admin"
        ? "/admin/settings/telegram"
        : "/me/telegram/status";
    const timer = window.setInterval(() => {
      api<{ chatLinked: boolean }>(path)
        .then((status) => {
          if (status.chatLinked) setActivated(true);
        })
        .catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [actor, activated, result]);

  const returnUrl = actor === "admin" ? "/admin/security" : "/app/telegram";

  const title = activated
    ? "Telegram tertaut"
    : result
      ? "Hampir selesai"
      : error
        ? "Tautan gagal"
        : "Memverifikasi…";

  const description = activated
    ? "Identitas OAuth dan chat pribadi sudah diverifikasi. Notifikasi Telegram aktif."
    : result
      ? "Satu langkah lagi: buka bot untuk mengonfirmasi chat pribadi dapat menerima pesan."
      : error
        ? error
        : "Mohon tunggu — ZITTOSITE sedang memverifikasi identitas Telegram Anda.";

  return (
    <AuthLayout
      eyebrow="ZITTOSITE · Telegram OAuth"
      title={title}
      description={description}
    >
      <div className="space-y-3">
        {result && !activated ? (
          <>
            <Button asChild className="w-full">
              <a href={result.botUrl} target="_blank" rel="noreferrer">
                Buka Telegram & aktifkan chat
              </a>
            </Button>
            <p className="text-label text-ink-faint">
              Tautan sekali pakai berlaku sampai{" "}
              {formatDateTime(result.expiresAt)}.
            </p>
          </>
        ) : null}

        {activated ? (
          <Button asChild className="w-full">
            <Link href={returnUrl}>Lanjutkan</Link>
          </Button>
        ) : null}

        {error ? (
          <Button asChild variant="secondary" className="w-full">
            <Link href={returnUrl}>Kembali</Link>
          </Button>
        ) : null}

        {!result && !error && !activated ? (
          <Button disabled className="w-full" loading loadingLabel="Memproses">
            Memproses
          </Button>
        ) : null}

        <p className="pt-2 text-center text-body text-ink-soft">
          <Link
            href={returnUrl}
            className="text-action underline-offset-2 hover:underline"
          >
            Kembali ke {actor === "admin" ? "Security" : "Telegram"}
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
