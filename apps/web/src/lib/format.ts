import { formatDistanceToNowStrict } from "date-fns";
import { id as idLocale } from "date-fns/locale";

/** All displayed times are WIB, regardless of the server's or browser's timezone. */
const TIME_ZONE = "Asia/Jakarta";

function jakartaParts(iso: string | Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** `YYYY-MM` of the WIB calendar month the instant falls in. */
export function jakartaMonthKey(iso: string | Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}`;
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateTime(iso: string): string {
  const p = jakartaParts(iso);
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`;
}

export function formatDate(iso: string): string {
  const p = jakartaParts(iso);
  return `${p.day} ${p.month} ${p.year}`;
}

export function formatTime(iso: string): string {
  const p = jakartaParts(iso);
  return `${p.hour}:${p.minute}`;
}

export function formatRelative(iso: string): string {
  return formatDistanceToNowStrict(new Date(iso), {
    locale: idLocale,
    addSuffix: true,
  });
}

export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}
