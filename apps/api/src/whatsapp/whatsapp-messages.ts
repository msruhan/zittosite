export type PaidInvoiceInput = {
  username: string;
  paidAt: Date;
  orders: Array<{ imei: string; serviceName: string }>;
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

/**
 * Group message for one paid invoice: user, payment time, and IMEIs grouped
 * per service in first-seen order with continuous numbering.
 */
export function paidInvoiceGroupText(input: PaidInvoiceInput): string {
  const byService = new Map<string, string[]>();
  for (const order of input.orders) {
    const imeis = byService.get(order.serviceName) ?? [];
    imeis.push(order.imei);
    byService.set(order.serviceName, imeis);
  }

  const lines = [
    "✅ *PEMBAYARAN DITERIMA*",
    "",
    `👤 User: *${stripWaMarkdown(input.username)}*`,
    `🕒 Dibayar: ${formatWib(input.paidAt)}`,
  ];
  let n = 0;
  for (const [serviceName, imeis] of byService) {
    lines.push("", `📦 *${stripWaMarkdown(serviceName)}*`);
    for (const imei of imeis) {
      n += 1;
      lines.push(`${n}. \`${imei}\``);
    }
  }
  return lines.join("\n");
}
