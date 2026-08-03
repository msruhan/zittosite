"use client";

import * as React from "react";
import { formatCountdown } from "@/lib/format";
import { cn } from "@/lib/utils";

function remainingSeconds(expiresAt: string): number {
  return Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
  );
}

/**
 * Tabular figures mean no digit change shifts the layout. The figure itself
 * slides 8px on each tick, so the change is felt without being read, and the
 * colour escalates as the window closes.
 *
 * Rendering is gated on mount: the server cannot know the visitor's clock,
 * and a mismatched first paint would be a hydration error.
 */
export function Countdown({
  expiresAt,
  onExpire,
  className,
}: {
  expiresAt: string;
  onExpire?: () => void;
  className?: string;
}) {
  const [seconds, setSeconds] = React.useState<number | null>(null);
  const firedRef = React.useRef(false);

  React.useEffect(() => {
    setSeconds(remainingSeconds(expiresAt));
    const timer = window.setInterval(() => {
      setSeconds(remainingSeconds(expiresAt));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  React.useEffect(() => {
    if (seconds === 0 && !firedRef.current) {
      firedRef.current = true;
      onExpire?.();
    }
  }, [seconds, onExpire]);

  const urgency =
    seconds === null
      ? "text-ink-faint"
      : seconds <= 60
        ? "text-refused-ink"
        : seconds <= 300
          ? "text-working-ink"
          : "text-ink";

  const display = seconds === null ? "--:--" : formatCountdown(seconds);

  return (
    <span
      role="timer"
      aria-live="off"
      className={cn(
        "font-data tabular text-display font-semibold transition-colors duration-300 ease-out-strong",
        urgency,
        className,
      )}
    >
      {/* Keyed so each tick replays the slide. */}
      <span key={display} className="inline-block animate-digit">
        {display}
      </span>
    </span>
  );
}
