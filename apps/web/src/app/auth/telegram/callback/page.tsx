"use client";

import * as React from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

type CompleteResult = {
  botUrl: string;
  expiresAt: string;
};

export default function TelegramOauthCallbackPage() {
  const started = React.useRef(false);
  const [result, setResult] = React.useState<CompleteResult | null>(null);
  const [actor, setActor] = React.useState<"user" | "admin">("user");
  const [activated, setActivated] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    const query = new URLSearchParams(window.location.search);
    const code = query.get("code") ?? "";
    const state = query.get("state") ?? "";
    const oauthError = query.get("error_description") ?? query.get("error");
    if (oauthError) {
      setError(`Telegram membatalkan OAuth: ${oauthError}`);
      return;
    }
    const nextActor = state.startsWith("a_") ? "admin" : "user";
    setActor(nextActor);
    api<CompleteResult>(
      nextActor === "admin"
        ? "/admin/settings/telegram/oauth/complete"
        : "/me/telegram/oauth/complete",
      {
        method: "POST",
        body: JSON.stringify({ code, state }),
      },
    )
      .then(setResult)
      .catch((reason: unknown) => {
        setError(
          reason instanceof ApiError
            ? reason.message
            : "Gagal memverifikasi OAuth Telegram",
        );
      });
  }, []);

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
