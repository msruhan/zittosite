import * as React from "react";
import { BrandLockup } from "@/components/shell/brand";
import { cn } from "@/lib/utils";

/**
 * Centered login shell on the Action Deep stage.
 */
export function AuthLayout({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-5 py-10 sm:px-8">
      <div aria-hidden="true" className="auth-stage pointer-events-none absolute inset-0" />
      <div
        aria-hidden="true"
        className="auth-orb pointer-events-none absolute -right-20 -top-16 size-[28rem] rounded-full bg-action/35 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="auth-orb-alt pointer-events-none absolute -bottom-24 -left-16 size-[24rem] rounded-full bg-accent-sky/25 blur-3xl"
      />

      <div className="relative w-full max-w-[24rem] reveal">
        <div className="mb-6">
          <BrandLockup className="[&_.text-headline]:text-white [&_svg]:size-10 [&_svg]:text-accent-sky" />
        </div>

        <div
          className={cn(
            "rounded-2xl border border-white/15 bg-surface p-6 shadow-overlay sm:p-7",
          )}
        >
          {eyebrow ? (
            <p className="mb-2.5 inline-flex items-center gap-2 text-label uppercase tracking-[0.14em] text-action">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-action shadow-[0_0_12px_var(--color-action)]"
              />
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-display text-ink">{title}</h1>
          {description ? (
            <p className="mt-2.5 text-body leading-relaxed text-ink-soft">
              {description}
            </p>
          ) : null}
          <div className={description ? "mt-7" : "mt-6"}>{children}</div>
        </div>

        <p className="mt-6 text-center text-body text-white/55">
          © 2026 ZittoSite. Seluruh hak cipta dilindungi.
        </p>
      </div>
    </div>
  );
}
