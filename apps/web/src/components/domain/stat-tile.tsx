import * as React from "react";
import Link from "next/link";
import {
  ChartLineUp,
  CheckCircle,
  ClockCountdown,
  Package,
  Wallet,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

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

const TONE = {
  action: {
    icon: Package,
    iconClass: "bg-action-wash text-action border-action/15",
  },
  sky: {
    icon: ChartLineUp,
    iconClass: "bg-action-wash text-action border-action/15",
  },
  cleared: {
    icon: CheckCircle,
    iconClass: "bg-cleared-wash text-cleared-ink border-cleared-edge/40",
  },
  working: {
    icon: ClockCountdown,
    iconClass: "bg-working-wash text-working-ink border-working-edge/40",
  },
  queued: {
    icon: ClockCountdown,
    iconClass: "bg-queued-wash text-queued-ink border-queued-edge/40",
  },
  hold: {
    icon: Wallet,
    iconClass: "bg-hold-wash text-hold-ink border-hold-edge/40",
  },
} as const;

export function StatTile({
  label,
  value,
  caption,
  hint,
  href,
  hrefLabel = "Lihat",
  trend,
  icon,
  tone = "action",
  className,
  index = 0,
}: StatTileProps) {
  const meta = TONE[tone] ?? TONE.action;
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        "group min-h-[126px] rounded-card border border-hairline bg-surface p-4 text-ink shadow-resting",
        "transition-[background-color,border-color,box-shadow] duration-150 ease-out-strong hover:border-action/25 hover:bg-white hover:shadow-lifted",
        className,
      )}
      style={{ animationDelay: `${Math.min(index, 6) * 55}ms` }}
    >
      <div className="flex h-full min-w-0 flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-4">
          <p className="text-label text-ink-soft">
          {label}
          {hint ? <span className="sr-only">. {hint}</span> : null}
          </p>
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-md border",
              meta.iconClass,
            )}
          >
            {icon ?? <Icon className="size-4" weight="regular" aria-hidden="true" />}
          </span>
        </div>

        <div>
          <p className="font-data text-metric text-ink">
            <span className="sr-only">{label}: </span>
            {value}
          </p>
          {trend ? (
            <p className="mt-2 text-label text-ink-soft">
              {trend.direction === "up" ? "Naik" : "Turun"} {trend.text}
            </p>
          ) : null}
        </div>

        {(caption || href) ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-hairline pt-3">
          {caption ? (
            <span className="text-label text-ink-soft">{caption}</span>
          ) : null}
          {href ? (
            <Link
              href={href}
              className="text-label font-bold text-action transition-colors hover:text-action-pressed hover:underline"
            >
              {hrefLabel}
            </Link>
          ) : null}
        </div>
        ) : null}
      </div>
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
        "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
