"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";

export function LoginForm({
  redirectTo,
  audience,
}: {
  redirectTo: string;
  audience: "user" | "admin";
}) {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [totpCode, setTotpCode] = React.useState("");
  const [pendingToken, setPendingToken] = React.useState<string | null>(null);
  const [revealed, setRevealed] = React.useState(false);
  const [remember, setRemember] = React.useState(true);
  const [errors, setErrors] = React.useState<{
    username?: string;
    password?: string;
    totpCode?: string;
  }>({});
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pendingToken) {
      if (!/^\d{6}$/.test(totpCode.trim())) {
        setErrors({ totpCode: "Masukkan kode 6 digit dari authenticator." });
        return;
      }
      setSubmitting(true);
      try {
        await api("/admin/auth/totp", {
          method: "POST",
          body: JSON.stringify({
            pendingToken,
            code: totpCode.trim(),
          }),
        });
        toast.success("Berhasil masuk", {
          description: "Selamat datang di panel Super Admin.",
        });
        router.push(redirectTo);
      } catch (error) {
        const message =
          error instanceof ApiError
            ? error.message
            : "Verifikasi 2FA gagal.";
        setErrors({ totpCode: message });
        toast.error("Gagal verifikasi 2FA", { description: message });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const nextErrors: typeof errors = {};
    if (!username.trim()) {
      nextErrors.username = "Masukkan username Anda untuk melanjutkan.";
    }
    if (!password) {
      nextErrors.password = "Masukkan password Anda untuk melanjutkan.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      if (audience === "admin") {
        const result = await api<{
          requiresTotp?: boolean;
          pendingToken?: string;
        }>("/admin/auth/login", {
          method: "POST",
          body: JSON.stringify({
            username: username.trim(),
            password,
          }),
        });
        if (result.requiresTotp && result.pendingToken) {
          setPendingToken(result.pendingToken);
          toast.message("Verifikasi 2FA", {
            description: "Masukkan kode dari Google Authenticator.",
          });
          return;
        }
        toast.success("Berhasil masuk", {
          description: "Selamat datang di panel Super Admin.",
        });
      } else {
        await api("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            username: username.trim(),
            password,
          }),
        });
        toast.success("Berhasil masuk", {
          description: "Selamat datang kembali di ZittoSite.",
        });
      }
      router.push(redirectTo);
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Login gagal.";
      toast.error("Gagal masuk", { description: message });
      setErrors({ password: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {pendingToken ? (
        <Field
          label="Kode Authenticator"
          htmlFor="totpCode"
          error={errors.totpCode}
          required
          hint="Buka Google Authenticator dan masukkan kode 6 digit."
        >
          <Input
            id="totpCode"
            name="totpCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            value={totpCode}
            invalid={Boolean(errors.totpCode)}
            onChange={(event) => {
              setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6));
              if (errors.totpCode)
                setErrors((e) => ({ ...e, totpCode: undefined }));
            }}
          />
        </Field>
      ) : (
        <>
          <Field
            label="Username"
            htmlFor="username"
            error={errors.username}
            required
          >
            <Input
              id="username"
              name="username"
              autoComplete="username"
              placeholder="Masukkan username"
              value={username}
              invalid={Boolean(errors.username)}
              onChange={(event) => {
                setUsername(event.target.value);
                if (errors.username)
                  setErrors((e) => ({ ...e, username: undefined }));
              }}
            />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            error={errors.password}
            required
          >
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={revealed ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Masukkan password"
                className="pr-11"
                value={password}
                invalid={Boolean(errors.password)}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (errors.password)
                    setErrors((e) => ({ ...e, password: undefined }));
                }}
              />
              <button
                type="button"
                onClick={() => setRevealed((v) => !v)}
                aria-label={
                  revealed ? "Sembunyikan password" : "Tampilkan password"
                }
                className={cn(
                  "absolute right-1 top-1 inline-flex size-8 items-center justify-center rounded-md text-ink-soft",
                  "transition-[background-color,color,transform] duration-150 ease-out-strong",
                  "hover:bg-mist hover:text-ink active:scale-[0.97]",
                )}
              >
                {revealed ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </Field>

          <label className="flex w-fit cursor-pointer items-center gap-2 text-body text-ink-soft">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="size-4 rounded-sm border-hairline text-action accent-action"
            />
            Ingat saya
          </label>
        </>
      )}

      <Button
        type="submit"
        block
        loading={submitting}
        loadingLabel="Memproses masuk"
      >
        {pendingToken ? "Verifikasi" : "Login"}
      </Button>

      {pendingToken ? (
        <button
          type="button"
          className="w-full text-center text-body font-medium text-ink-soft hover:text-ink"
          onClick={() => {
            setPendingToken(null);
            setTotpCode("");
            setErrors({});
          }}
        >
          Kembali ke login
        </button>
      ) : (
        <p className="text-center text-body text-ink-soft">
          Butuh bantuan?{" "}
          <Link
            href="https://t.me/"
            className="inline-flex items-center gap-1 font-medium text-action underline-offset-4 hover:underline"
          >
            <Send className="size-3.5" aria-hidden="true" />
            Support Telegram
          </Link>
        </p>
      )}
    </form>
  );
}
