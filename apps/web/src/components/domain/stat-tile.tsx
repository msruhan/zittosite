import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUp, Info, MoreVertical } from "lucide-react";
import {
  CardAtmosphere,
  type CardAtmosphereTone,
} from "@/components/ui/card-atmosphere";
import { cn } from "@/lib/utils";

const TREND_CHIP = {
  up: {
    chip: "bg-cleared-wash text-metric-green",
    disc: "bg-metric-green/15 text-metric-green",
  },
  down: {
    chip: "bg-refused-wash text-metric-red",
    disc: "bg-metric-red/15 text-metric-red",
  },
} as const;

const TONE_TO_ATMOSPHERE: Record<string, CardAtmosphereTone> = {
  action: "action",
  sky: "sky",
  cleared: "cleared",
  working: "working",
  queued: "action",
  hold: "working",
};

export type StatTone =
  | "action"
  | "sky"
  | "cleared"
  | "working"
  | "queued"
  | "hold";

export interface StatTileProps {
  label: string;
  value: React.ReactNode;
  caption?: string;
  hint?: string;
  href?: string;
  hrefLabel?: string;
  trend?: { direction: "up" | "down"; text: string };
  /** @deprecated Icons are no longer shown; tone drives atmosphere. */
  icon?: React.ReactNode;
  tone?: StatTone;
  className?: string;
  index?: number;
}

/**
 * Metric card — soft radius, mesh atmosphere, title / figure / detail footer.
 */
export function StatTile({
  label,
  value,
  caption,
  hint,
  href,
  hrefLabel = "Lihat detail",
  trend,
  tone = "action",
  className,
  index = 0,
}: StatTileProps) {
  const TrendIcon = trend?.direction === "down" ? ArrowDown : ArrowUp;
  const trendTone = trend ? TREND_CHIP[trend.direction] : null;
  const atmosphereTone = TONE_TO_ATMOSPHERE[tone] ?? "action";

  return (
    <div
      className={cn(
        "card-shell group relative flex flex-col overflow-hidden p-5 sm:p-6",
        "transition-[transform,box-shadow] duration-200 ease-out-strong",
        "hover:-translate-y-0.5 hover:shadow-lifted",
        "reveal",
        className,
      )}
      style={{ animationDelay: `${Math.min(index, 4) * 40}ms` }}
    >
      <CardAtmosphere tone={atmosphereTone} />

      <div className="relative z-10 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <h3 className="truncate text-title font-bold text-ink">{label}</h3>
          {hint ? (
            <span
              title={hint}
              className="inline-flex text-ink-faint"
              aria-label={hint}
            >
              <Info aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
            </span>
          ) : null}
        </div>

        {href ? (
          <Link
            href={href}
            aria-label={`${hrefLabel}: ${label}`}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-hairline/80 bg-surface/80 text-ink-faint transition-colors duration-150 ease-out-strong hover:bg-surface hover:text-ink"
          >
            <MoreVertical className="size-4" strokeWidth={1.75} />
          </Link>
        ) : (
          <span
            aria-hidden="true"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-hairline/80 bg-surface/70 text-ink-faint"
          >
            <MoreVertical className="size-4" strokeWidth={1.75} />
          </span>
        )}
      </div>

      <div className="relative z-10 mt-5 flex flex-wrap items-center gap-2.5 sm:mt-6">
        <p className="font-data tabular text-display font-bold tracking-tight text-ink">
          <span className="sr-only">{label}: </span>
          {value}
        </p>
        {trend && trendTone ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label font-medium",
              trendTone.chip,
            )}
          >
            <span
              className={cn(
                "inline-flex size-4 items-center justify-center rounded-full",
                trendTone.disc,
              )}
            >
              <TrendIcon className="size-2.5" strokeWidth={2.75} />
            </span>
            {trend.text}
            <span className="sr-only">
              {trend.direction === "up" ? "naik" : "turun"}
            </span>
          </span>
        ) : null}
      </div>

      {(caption || href) && (
        <div className="relative z-10 mt-auto flex items-end justify-between gap-3 pt-5">
          {caption ? (
            <p className="text-body text-ink-soft">{caption}</p>
          ) : (
            <span />
          )}
          {href ? (
            <Link
              href={href}
              className="inline-flex shrink-0 items-center gap-1 text-body font-bold text-ink transition-colors duration-150 ease-out-strong hover:text-action"
            >
              {hrefLabel}
              <ArrowRight
                aria-hidden="true"
                className="size-3.5"
                strokeWidth={2.25}
              />
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function StatGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4 sm:gap-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
