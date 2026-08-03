export const TELEGRAM_PARSE_MODE = "HTML" as const;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(icon: string, label: string, value: string, code = false): string {
  const v = code ? `<code>${escapeHtml(value)}</code>` : escapeHtml(value);
  return `${icon} <b>${escapeHtml(label)}:</b> ${v}`;
}

export function formatCredits(n: number): string {
  return `${n.toLocaleString("id-ID")} kredit`;
}

export function unlinkedHtml(loginUrl: string): string {
  return [
    "🔗 <b>Akun belum tertaut</b>",
    "<i>Hubungkan Telegram ke ZITTOSITE untuk cek saldo dan notifikasi.</i>",
    "",
    "1️⃣ Login di website:",
    escapeHtml(loginUrl),
    "2️⃣ Buka <b>Telegram</b> → Tautkan dengan Telegram",
    "3️⃣ Setujui OAuth lalu tekan <b>Buka Telegram</b>",
  ].join("\n");
}

export function linkSuccessHtml(actorType: "admin" | "member"): string {
  if (actorType === "admin") {
    return [
      "✅ <b>Telegram Admin tertaut</b>",
      "<i>Notifikasi ZITTOSITE aktif.</i>",
      "",
      "Ketik /status untuk melihat akun.",
    ].join("\n");
  }
  return [
    "✅ <b>Telegram berhasil ditautkan</b>",
    "<i>Akun ZITTOSITE Anda sudah terhubung.</i>",
    "",
    "Ketik /status untuk melihat akun.",
  ].join("\n");
}

export function linkFailedHtml(): string {
  return [
    "⚠️ <b>Tautan gagal</b>",
    "Tautan Telegram tidak valid, tidak cocok, atau sudah kedaluwarsa.",
    "",
    "<i>Buat tautan baru dari menu Telegram di portal.</i>",
  ].join("\n");
}

export function startLinkedMemberHtml(input: {
  username: string;
  balance: number;
}): string {
  return [
    "✨ <b>ZITTOSITE Bot</b>",
    "<i>Akun tertaut</i>",
    "",
    row("👤", "Username", input.username),
    row("💎", "Saldo", formatCredits(input.balance)),
    "",
    "Ketik / untuk daftar perintah.",
  ].join("\n");
}

export function startLinkedAdminHtml(input: {
  username: string;
  role: string;
}): string {
  return [
    "✨ <b>ZITTOSITE Bot</b>",
    "<i>Telegram Admin tertaut</i>",
    "",
    row("👤", "Username", input.username),
    row("🛡️", "Role", input.role),
    "",
    "Ketik / untuk daftar perintah.",
  ].join("\n");
}

export function statusMemberHtml(input: {
  fullName: string;
  username: string;
  balance: number;
  status: string;
  portalUrl: string;
}): string {
  return [
    "👤 <b>Status akun ZITTOSITE</b>",
    "",
    row("🪪", "Nama", input.fullName),
    row("🔖", "Username", input.username),
    row("💎", "Saldo", formatCredits(input.balance)),
    row("🟢", "Status", input.status),
    row("🔗", "Telegram", "tertaut"),
    "",
    `🌐 Portal: ${escapeHtml(input.portalUrl)}`,
  ].join("\n");
}

export function statusAdminHtml(input: {
  username: string;
  role: string;
  status: string;
  portalUrl: string;
}): string {
  return [
    "🛡️ <b>Status Admin ZITTOSITE</b>",
    "",
    row("👤", "Username", input.username),
    row("🏷️", "Role", input.role),
    row("🟢", "Status", input.status),
    row("🔗", "Telegram", "tertaut"),
    "",
    `🌐 Portal Admin: ${escapeHtml(input.portalUrl)}`,
  ].join("\n");
}

export function saldoMemberHtml(input: {
  balance: number;
  portalUrl: string;
}): string {
  return [
    "💎 <b>Saldo kredit</b>",
    "",
    row("💰", "Saldo", formatCredits(input.balance)),
    "",
    `🌐 Portal: ${escapeHtml(input.portalUrl)}`,
  ].join("\n");
}

export function saldoAdminHtml(): string {
  return [
    "💎 <b>Saldo kredit</b>",
    "",
    "<i>Saldo kredit hanya untuk akun user. Admin memakai Telegram untuk notifikasi.</i>",
  ].join("\n");
}

export function blockedHtml(): string {
  return ["🚫 <b>Akun ditangguhkan</b>", "Hubungi admin untuk bantuan."].join(
    "\n",
  );
}

export function botDisabledHtml(telegramUrl: string): string {
  return [
    "🚫 <b>Bot tidak aktif</b>",
    "Akses bot untuk akun ini dinonaktifkan oleh admin.",
    "",
    `🌐 Portal: ${escapeHtml(telegramUrl)}`,
  ].join("\n");
}

export function maskImeiHtml(imei: string): string {
  if (imei.length <= 3) return escapeHtml(imei);
  return `<code>${escapeHtml(imei.slice(0, 3) + "X".repeat(imei.length - 3))}</code>`;
}

export function formatRp(n: number): string {
  return `Rp${n.toLocaleString("id-ID")}`;
}

export function newOrderAdminHtml(input: {
  orderId: string;
  imei: string;
  serviceName: string;
  userName: string;
  price: number;
}): string {
  return [
    "🆕 <b>ORDER BARU</b>",
    "",
    row("🎫", "Order ID", input.orderId, true),
    row("📱", "IMEI", input.imei.slice(0, 3) + "X".repeat(Math.max(0, input.imei.length - 3)), true),
    row("📦", "Layanan", input.serviceName),
    row("👤", "User", input.userName),
    row("💰", "Harga", formatRp(input.price)),
    row("🟢", "Status", "waiting_action"),
  ].join("\n");
}

export function orderCardTakenHtml(input: {
  orderId: string;
  imei: string;
  serviceName: string;
  actorName: string;
}): string {
  return [
    "🛠️ <b>IN PROCESS</b>",
    "",
    row("🎫", "Order ID", input.orderId, true),
    row("📱", "IMEI", input.imei.slice(0, 3) + "X".repeat(Math.max(0, input.imei.length - 3)), true),
    row("📦", "Layanan", input.serviceName),
    row("👷", "Diambil oleh", input.actorName),
  ].join("\n");
}

export function orderCardRejectedHtml(input: {
  orderId: string;
  actorName: string;
  reason: string;
}): string {
  return [
    "❌ <b>REJECTED</b>",
    "",
    row("🎫", "Order ID", input.orderId, true),
    row("👷", "Oleh", input.actorName),
    row("📝", "Alasan", input.reason),
  ].join("\n");
}

export function orderCardDoneHtml(input: {
  orderId: string;
  actorName: string;
  note: string;
}): string {
  return [
    "✅ <b>DONE</b>",
    "",
    row("🎫", "Order ID", input.orderId, true),
    row("👷", "Oleh", input.actorName),
    row("📝", "Hasil", input.note),
  ].join("\n");
}

export function orderHistoryHtml(
  lines: Array<{
    orderId: string;
    serviceName: string;
    status: string;
    imei: string;
  }>,
): string {
  if (!lines.length) {
    return [
      "📋 <b>Riwayat order</b>",
      "",
      "<i>Belum ada order.</i>",
    ].join("\n");
  }
  return [
    "📋 <b>Riwayat order</b>",
    "",
    ...lines.map(
      (o, i) =>
        `${i + 1}. <code>${escapeHtml(o.orderId)}</code> — ${escapeHtml(o.serviceName)}\n   ${escapeHtml(o.status)} · ${maskImeiHtml(o.imei)}`,
    ),
  ].join("\n");
}

export function orderCreatedHtml(input: {
  orderId: string;
  payUrl: string;
  amount: number;
}): string {
  return [
    "✅ <b>Order dibuat</b>",
    "",
    row("🎫", "Order ID", input.orderId, true),
    row("💰", "Tagihan", formatRp(input.amount)),
    "",
    "Bayar di portal:",
    escapeHtml(input.payUrl),
  ].join("\n");
}

