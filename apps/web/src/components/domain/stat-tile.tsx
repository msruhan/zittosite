import * as React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CircleCheck,
  Package,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TONE_ICON = {
  action: Package,
  sky: Wallet,
  cleared: CircleCheck,
  working: Activity,
  queued: Package,
  hold: Activity,
} as const;

/** Decorative sparklines — visual rhythm only, not live series. */
const SPARKLINES = [
  "M0 28 C18 26, 28 8, 44 14 S72 36, 88 22 S120 4, 144 16 S168 34, 192 18",
  "M0 22 C20 30, 36 34, 52 24 S84 6, 104 14 S136 32, 160 20 S176 10, 192 12",
  "M0 30 C16 18, 32 10, 48 16 S80 34, 100 28 S132 8, 152 14 S176 26, 192 20",
  "M0 18 C24 12, 40 28, 60 30 S96 8, 116 10 S148 28, 168 24 S184 14, 192 16",
] as const;

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
  icon?: React.ReactNode;
  tone?: StatTone;
  className?: string;
  index?: number;
}

/**
 * Metric card — alternates blue gradient (even) and black panel (odd).
 */
export function StatTile({
  label,
  value,
  caption,
  hint,
  href,
  hrefLabel = "Lihat detail",
  trend,
  icon,
  tone = "action",
  className,
  index = 0,
}: StatTileProps) {
  const DefaultIcon = TONE_ICON[tone] ?? Package;
  const spark = SPARKLINES[index % SPARKLINES.length]!;
  const variant: "blue" | "black" = index % 2 === 0 ? "blue" : "black";
  const isBlue = variant === "blue";

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[1.35rem] p-5 text-white sm:p-6",
        "ring-1 ring-white/10",
        "transition-[transform,box-shadow] duration-200 ease-out-strong",
        "hover:-translate-y-1",
        "reveal",
        isBlue
          ? "shadow-[0_18px_40px_-18px_rgba(30,58,138,0.55)] hover:shadow-[0_22px_48px_-16px_rgba(30,58,138,0.65)]"
          : "bg-gradient-to-br from-panel-night via-ink to-panel-black shadow-[0_18px_40px_-18px_rgba(0,0,0,0.65)] hover:shadow-[0_22px_48px_-14px_rgba(0,0,0,0.75)]",
        className,
      )}
      style={{
        animationDelay: `${Math.min(index, 4) * 40}ms`,
        ...(isBlue
          ? {
              backgroundImage:
                "linear-gradient(145deg, var(--color-accent-sky) 0%, var(--color-action) 48%, var(--color-action-deep) 100%)",
            }
          : undefined),
      }}
    >
      {isBlue ? (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-white/20 blur-2xl"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-12 -left-6 size-36 rounded-full bg-action-deep/50 blur-2xl"
          />
        </>
      ) : (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-action/30 blur-3xl"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 left-1/4 size-40 rounded-full bg-accent-sky/15 blur-3xl"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
          />
        </>
      )}

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                "truncate text-body font-medium",
                isBlue ? "text-white/80" : "text-white/70",
              )}
            >
              {label}
            </p>
            {hint ? <span className="sr-only">{hint}</span> : null}
          </div>
          <p className="mt-1.5 font-data tabular text-display font-bold tracking-tight text-white">
            <span className="sr-only">{label}: </span>
            {value}
          </p>
          {trend ? (
            <p className="mt-1 text-label text-white/65">
              {trend.direction === "up" ? "↑" : "↓"} {trend.text}
            </p>
          ) : null}
        </div>

        <span
          aria-hidden="true"
          className={cn(
            "inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-white backdrop-blur-sm ring-1",
            isBlue
              ? "bg-white/15 ring-white/25"
              : "bg-white/8 ring-white/15",
          )}
        >
          {icon ?? <DefaultIcon className="size-5" strokeWidth={1.75} />}
        </span>
      </div>

      <div className="relative z-10 mt-5 sm:mt-6" aria-hidden="true">
        <svg
          viewBox="0 0 192 40"
          className="h-10 w-full overflow-visible"
          fill="none"
        >
          <path
            d={spark}
            stroke={isBlue ? "rgba(255,255,255,0.92)" : "var(--color-accent-sky)"}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={
              isBlue
                ? undefined
                : "drop-shadow-[0_0_6px_color-mix(in_oklab,var(--color-accent-sky)_65%,transparent)]"
            }
          />
          <path
            d={`${spark} L192 40 L0 40 Z`}
            fill={`url(#stat-spark-fill-${index})`}
            opacity={isBlue ? 0.22 : 0.35}
          />
          <defs>
            <linearGradient
              id={`stat-spark-fill-${index}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor={isBlue ? "#ffffff" : "var(--color-accent-sky)"}
                stopOpacity="0.45"
              />
              <stop
                offset="100%"
                stopColor={isBlue ? "#ffffff" : "var(--color-accent-sky)"}
                stopOpacity="0"
              />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {(caption || href) && (
        <div className="relative z-10 mt-auto flex flex-wrap items-center gap-2 pt-5">
          {caption ? (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1.5 text-label font-medium backdrop-blur-sm ring-1",
                isBlue
                  ? "bg-white/15 text-white ring-white/20"
                  : "bg-panel-black/70 text-white/90 ring-white/10",
              )}
            >
              {caption}
            </span>
          ) : null}
          {href ? (
            <Link
              href={href}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-label font-semibold text-white",
                "ring-1 backdrop-blur-sm",
                "transition-[background-color,transform] duration-150 ease-out-strong",
                "active:scale-[0.98]",
                isBlue
                  ? "bg-white/20 ring-white/25 hover:bg-white/30"
                  : "bg-panel-black/80 ring-white/12 hover:bg-panel-black",
              )}
            >
              {hrefLabel}
              <ArrowRight
                className="size-3.5"
                strokeWidth={2.25}
                aria-hidden="true"
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
