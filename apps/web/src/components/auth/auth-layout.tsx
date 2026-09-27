import * as React from "react";
import { BrandLockup } from "@/components/shell/brand";
import { cn } from "@/lib/utils";

/**
 * Light paper login. The form is the counter. No inverted stage.
 */
export function AuthLayout({
  eyebrow,
  title,
  description,
  panel,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  panel?: {
    kicker: string;
    heading: string;
    body: string;
    steps: string[];
  };
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-ground">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12 lg:flex-row lg:items-center lg:gap-16 lg:py-16">
        <div className="w-full max-w-md lg:max-w-[26rem]">
          <BrandLockup />

          <div className="mt-10">
            {eyebrow ? (
              <p className="mb-2 text-label text-action">{eyebrow}</p>
            ) : null}
            <h1 className="text-display text-ink">{title}</h1>
            {description ? (
              <p className="mt-3 max-w-[42ch] text-body text-ink-soft">
                {description}
              </p>
            ) : null}
          </div>

          <div className="mt-8">{children}</div>
        </div>

        {panel ? (
          <aside
            className={cn(
              "mt-14 hidden w-full max-w-md lg:mt-0 lg:block lg:max-w-sm",
              "lg:ml-auto",
            )}
          >
            <div className="card-shell p-6">
              <p className="text-label text-ink-soft">{panel.kicker}</p>
              <p className="mt-2 font-data tabular text-headline text-ink">
                {panel.heading}
              </p>
              <p className="mt-2 max-w-[36ch] text-body text-ink-soft">
                {panel.body}
              </p>
              <ol className="mt-6 space-y-3 border-t border-hairline pt-5">
                {panel.steps.map((step, index) => (
                  <li key={step} className="flex gap-3 text-body text-ink">
                    <span className="font-data tabular w-5 shrink-0 text-action">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        ) : null}
      </div>

      <p className="px-5 pb-6 text-center text-label text-ink-faint sm:px-8">
        © 2026 ZittoSite. Seluruh hak cipta dilindungi.
      </p>
    </div>
  );
}
