export type PaidInvoiceOrder = {
  orderId: string;
  imei: string;
  serviceName: string;
};

export type PaidInvoiceInput = {
  username: string;
  channel: "web" | "telegram";
  total: number;
  paidAt: Date;
  orders: PaidInvoiceOrder[];
};

const DIV = "──────────────";

/** Removes WhatsApp formatting markers so user-supplied text cannot restyle the message. */
export function stripWaMarkdown(value: string): string {
  return value.replace(/[*_~`]/g, "").trim();
}

export function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
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

/** Group message for one paid invoice; orders are grouped per service in first-seen order. */
export function paidInvoiceGroupText(input: PaidInvoiceInput): string {
  const byService = new Map<string, PaidInvoiceOrder[]>();
  for (const order of input.orders) {
    const list = byService.get(order.serviceName) ?? [];
    list.push(order);
    byService.set(order.serviceName, list);
  }

  const lines = [
    "✅ *PEMBAYARAN DITERIMA*",
    DIV,
    `👤 User: *${stripWaMarkdown(input.username)}*`,
    `🛒 Via: ${input.channel === "telegram" ? "Telegram" : "Web"}`,
    `💰 Total: *${formatRupiah(input.total)}*`,
    `🕒 Dibayar: ${formatWib(input.paidAt)}`,
  ];
  let n = 0;
  for (const [serviceName, orders] of byService) {
    lines.push("", `📦 *${stripWaMarkdown(serviceName)}* (${orders.length} order)`);
    for (const order of orders) {
      n += 1;
      lines.push(`${n}. \`${order.orderId}\` · \`${order.imei}\``);
    }
  }
  return lines.join("\n");
}
