import type { ServiceInputType } from "@prisma/client";

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

/**
 * Admin group card for one order: just the service and the device value, so
 * admins can copy the IMEI. Reactions find the order by the card's message id.
 * The customer's note stays on the website for Super Admins.
 */
export function adminOrderCardText(input: {
  serviceName: string;
  inputType: ServiceInputType;
  imei: string;
  isTest?: boolean;
}): string {
  return [
    ...(input.isTest ? ["🧪 *TESTING*"] : []),
    input.serviceName,
    ...(input.inputType === "none" ? [] : [input.imei]),
  ].join("\n");
}

export type AdminReactionReply =
  | { kind: "taken"; adminName: string }
  | { kind: "done"; adminName: string }
  | { kind: "rejected"; adminName: string; refunded: boolean }
  | { kind: "cancelled"; reason: string }
  | { kind: "refused"; message: string };

/** Short reply quoting the order card after a reaction (or a cancel elsewhere). */
export function adminReactionReplyText(reply: AdminReactionReply): string {
  switch (reply.kind) {
    case "taken":
      return `⏳ Diproses oleh *${reply.adminName}*`;
    case "done":
      return `Done ✅ · ${reply.adminName}`;
    case "rejected":
      return `Ditolak ❌ · ${reply.adminName}${reply.refunded ? "\nDana dikembalikan ke saldo user." : ""}`;
    case "cancelled":
      return `🚫 Order dibatalkan Super Admin. Jangan diproses.\nAlasan: ${reply.reason}`;
    case "refused":
      return `⚠️ ${reply.message}`;
  }
}

export type DailyCountRow = {
  /** "HH:mm" WIB. */
  time: string;
  imei: string;
  status: "in_process" | "done" | "rejected";
};

const DAILY_COUNT_MARK: Record<DailyCountRow["status"], string> = {
  in_process: "⏳",
  done: "✅",
  rejected: "❌",
};

/** Reply to "/hitung": the orders an admin handled today, oldest first. */
export function adminDailyCountText(input: {
  adminName: string;
  /** "dd-mm-yyyy" WIB. */
  date: string;
  rows: DailyCountRow[];
}): string {
  const count = (status: DailyCountRow["status"]) =>
    input.rows.filter((row) => row.status === status).length;
  return [
    `📊 *Order Hari Ini — ${input.adminName}*`,
    `📅 ${input.date}`,
    "",
    ...(input.rows.length
      ? input.rows.map(
          (row, i) => `${i + 1}. [${row.time}] ${row.imei} ${DAILY_COUNT_MARK[row.status]}`,
        )
      : ["_Belum ada order yang diproses hari ini._"]),
    "",
    `Total IMEI masuk : ${input.rows.length}`,
    `✅ Done : ${count("done")}`,
    `⏳ Proses : ${count("in_process")}`,
    `❌ Ditolak : ${count("rejected")}`,
  ].join("\n");
}
