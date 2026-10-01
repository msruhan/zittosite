"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Copy } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface CodeSample {
  label: string;
  code: string;
}

function useCopy() {
  const [copied, setCopied] = React.useState(false);
  const copy = React.useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Tidak dapat menyalin", { description: "Salin secara manual." });
    }
  }, []);
  return { copied, copy };
}

/** Dark code surface with optional language tabs and a copy action. */
export function CodePanel({
  samples,
  title,
  badge,
  className,
}: {
  samples: CodeSample[];
  title?: string;
  badge?: React.ReactNode;
  className?: string;
}) {
  const [active, setActive] = React.useState(0);
  const { copied, copy } = useCopy();
  const id = React.useId();
  const current = samples[active] ?? samples[0]!;
  const tabbed = samples.length > 1;

  return (
    <div className={cn("overflow-hidden rounded-lg border border-rail bg-rail shadow-resting", className)}>
      <div className="flex min-h-10 items-center gap-2 border-b border-white/10 bg-rail-soft px-2">
        {tabbed ? (
          <div role="tablist" aria-label={title ?? "Contoh kode"} className="flex min-w-0 gap-0.5 overflow-x-auto">
            {samples.map((sample, index) => (
              <button
                key={sample.label}
                type="button"
                role="tab"
                id={`${id}-tab-${index}`}
                aria-selected={index === active}
                aria-controls={`${id}-panel`}
                onClick={() => setActive(index)}
                className={cn(
                  "h-7 shrink-0 rounded-md px-2.5 text-label font-bold transition-colors duration-150",
                  index === active
                    ? "bg-white/10 text-white"
                    : "text-nav-ink/70 hover:bg-white/5 hover:text-white",
                )}
              >
                {sample.label}
              </button>
            ))}
          </div>
        ) : (
          <span className="px-1.5 text-label font-bold text-nav-ink/80">{title ?? current.label}</span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {badge}
          <button
            type="button"
            onClick={() => void copy(current.code)}
            aria-label="Salin kode"
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-label text-nav-ink/80",
              "transition-[background-color,color,transform] duration-150 hover:bg-white/10 hover:text-white active:scale-[0.97]",
            )}
          >
            {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
            {copied ? "Tersalin" : "Salin"}
          </button>
        </div>
      </div>
      <pre
        id={`${id}-panel`}
        role={tabbed ? "tabpanel" : undefined}
        aria-labelledby={tabbed ? `${id}-tab-${active}` : undefined}
        className="scroll-region max-h-[28rem] px-4 py-3.5 font-mono text-label leading-relaxed text-nav-ink"
      >
        <code>{current.code}</code>
      </pre>
    </div>
  );
}

/** Inline value with a copy action, for the base URL and credentials. */
export function CopyValue({ value, label }: { value: string; label: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="flex items-center gap-2 rounded-lg border border-hairline bg-surface py-1 pl-3 pr-1">
      <code className="min-w-0 flex-1 truncate font-mono text-label text-ink">{value}</code>
      <button
        type="button"
        onClick={() => void copy(value)}
        aria-label={`Salin ${label}`}
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-label font-bold text-ink-soft",
          "transition-[background-color,color,transform] duration-150 hover:bg-mist hover:text-ink active:scale-[0.97]",
        )}
      >
        {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
        {copied ? "Tersalin" : "Salin"}
      </button>
    </div>
  );
}
