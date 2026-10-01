export type PaidInvoiceInput = {
  paidAt: Date;
  orders: Array<{ imei: string }>;
};

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

/** Group message for one paid invoice: payment time and numbered IMEIs. Service names stay private. */
export function paidInvoiceGroupText(input: PaidInvoiceInput): string {
  return [
    "✅ *PEMBAYARAN DITERIMA*",
    "",
    `🕒 Dibayar: ${formatWib(input.paidAt)}`,
    "",
    ...input.orders.map((order, i) => `${i + 1}. \`${order.imei}\``),
  ].join("\n");
}
