import { cn } from "@/lib/utils";

/**
 * Identifiers, amounts, timestamps, and timers — Satoshi with tabular figures
 * so digits hold their columns and never jitter (no separate mono face).
 */
export function DataValue({
  children,
  className,
  emphasis = false,
}: {
  children: React.ReactNode;
  className?: string;
  emphasis?: boolean;
}) {
  return (
    <span
      className={cn(
        "font-data tabular",
        emphasis ? "text-ink font-semibold" : "text-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** The Order ID is never truncated and never abbreviated. */
export function TicketId({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-data tabular text-headline font-semibold text-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}
