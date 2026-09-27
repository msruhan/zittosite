import * as React from "react";
import { BrandLockup } from "@/components/shell/brand";

/**
 * Light paper login. One centered sheet, the form is the counter.
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
    <div className="flex min-h-dvh flex-col bg-ground">
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 sm:py-16">
        <div className="reveal w-full max-w-[25rem]">
          <BrandLockup className="justify-center" />

          <section className="card-shell mt-8 px-5 py-7 sm:px-8 sm:py-9">
            <header className="text-center">
              {eyebrow ? (
                <p className="mb-2 text-label text-action">{eyebrow}</p>
              ) : null}
              <h1 className="text-display text-balance text-ink">{title}</h1>
              {description ? (
                <p className="mx-auto mt-2 max-w-[34ch] text-body text-pretty text-ink-soft">
                  {description}
                </p>
              ) : null}
            </header>

            <div className="mt-7">{children}</div>
          </section>
        </div>
      </main>

      <p className="px-5 pb-6 text-center text-label text-ink-faint sm:px-8">
        © 2026 ZittoSite. Seluruh hak cipta dilindungi.
      </p>
    </div>
  );
}
