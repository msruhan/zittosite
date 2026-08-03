import { format, formatDistanceToNowStrict } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateTime(iso: string): string {
  return format(new Date(iso), "d MMM yyyy, HH:mm", { locale: idLocale });
}

export function formatDate(iso: string): string {
  return format(new Date(iso), "d MMM yyyy", { locale: idLocale });
}

export function formatTime(iso: string): string {
  return format(new Date(iso), "HH:mm", { locale: idLocale });
}

export function formatRelative(iso: string): string {
  return formatDistanceToNowStrict(new Date(iso), {
    locale: idLocale,
    addSuffix: true,
  });
}

/**
 * IMEI is a device identifier, so lists show only enough to recognise the
 * row. Length is preserved so the column never changes width.
 */
export function maskImei(imei: string): string {
  if (imei.length <= 3) return imei;
  return imei.slice(0, 3) + "X".repeat(imei.length - 3);
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
