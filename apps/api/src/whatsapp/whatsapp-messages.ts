export type PaidInvoiceInput = {
  username: string;
  paidAt: Date;
  imeis: string[];
};

/** Removes WhatsApp formatting markers so user-supplied text cannot restyle the message. */
export function stripWaMarkdown(value: string): string {
  return value.replace(/[*_~`]/g, "").trim();
}

export function formatWib(date: Date): string {
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")} WIB`;
}

/** Group message for one paid invoice: user, payment time and IMEIs. */
export function paidInvoiceGroupText(input: PaidInvoiceInput): string {
  return [
    "✅ *PEMBAYARAN DITERIMA*",
    "",
    `👤 User: *${stripWaMarkdown(input.username)}*`,
    `🕒 Dibayar: ${formatWib(input.paidAt)}`,
    "",
    "📱 IMEI:",
    ...input.imeis.map((imei, i) => `${i + 1}. \`${imei}\``),
  ].join("\n");
}
