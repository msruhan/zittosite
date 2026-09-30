"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { formatTime } from "@/lib/format";

export const AUTO_REFRESH_MS = 60_000;

/**
 * Re-runs the page's server fetch every minute while the tab is visible.
 * Pass `paused` while the user is mid-edit so the data doesn't shift under them.
 */
export function useAutoRefresh({ paused = false }: { paused?: boolean } = {}) {
  const router = useRouter();
  const [refreshing, startRefresh] = React.useTransition();
  const lastRefreshAt = React.useRef(0);

  React.useEffect(() => {
    if (paused) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      lastRefreshAt.current = Date.now();
      startRefresh(() => router.refresh());
    };
    const timer = window.setInterval(refresh, AUTO_REFRESH_MS);
    // Catch up immediately when returning to a tab whose data went stale in the background.
    const onVisible = () => {
      if (Date.now() - lastRefreshAt.current >= AUTO_REFRESH_MS) refresh();
    };
    lastRefreshAt.current = Date.now();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [paused, router]);

  return { refreshing };
}

export function AutoRefreshStatus({
  fetchedAt,
  refreshing,
}: {
  fetchedAt: string;
  refreshing: boolean;
}) {
  return (
    <p aria-live="polite" suppressHydrationWarning>
      {refreshing
        ? "Memperbarui…"
        : `Diperbarui ${formatTime(fetchedAt)} · otomatis tiap 1 menit`}
    </p>
  );
}
