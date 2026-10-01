export const TOPUP_MIN = 10_000;
export const TOPUP_MAX = 5_000_000;
export const TOPUP_PRESETS = [50_000, 100_000, 250_000, 500_000] as const;

/**
 * Whole Rupiah within the topup limits. Accepts numbers or digit strings with
 * thousand separators ("100.000", "Rp 100,000"). Returns null when invalid.
 */
export function parseTopupAmount(value: unknown): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\s*(?:rp\.?)?\s*[\d.,\s]+$/i.test(value)
        ? Number(value.replace(/\D/g, ""))
        : NaN;
  if (!Number.isSafeInteger(n) || n < TOPUP_MIN || n > TOPUP_MAX) return null;
  return n;
}

export function topupLimitMessage(): string {
  return `Nominal topup Rp${TOPUP_MIN.toLocaleString("id-ID")}–Rp${TOPUP_MAX.toLocaleString("id-ID")}.`;
}

/** `TP<yymmdd>` for today in Asia/Jakarta. */
export function topupIdPrefix(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `TP${get("year")}${get("month")}${get("day")}`;
}
