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
    row("💎", "Saldo", formatRp(input.balance)),
    "",
    "Pilih menu di bawah, atau ketik /menu kapan saja.",
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
    row("💎", "Saldo", formatRp(input.balance)),
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
  portalUrl?: string;
}): string {
  const lines = [
    "🛡️ <b>Status Admin ZITTOSITE</b>",
    "",
    row("👤", "Username", input.username),
    row("🏷️", "Role", input.role),
    row("🟢", "Status", input.status),
    row("🔗", "Telegram", "tertaut"),
  ];
  if (input.portalUrl) {
    lines.push("", `🌐 Portal Admin: ${escapeHtml(input.portalUrl)}`);
  }
  return lines.join("\n");
}

const RECAP_STATUS: Record<string, { icon: string; label: string }> = {
  waiting_payment: { icon: "⏳", label: "Menunggu bayar" },
  paid: { icon: "💳", label: "Dibayar" },
  waiting_action: { icon: "📥", label: "Antrean" },
  in_process: { icon: "🛠️", label: "Dikerjakan" },
  done: { icon: "✅", label: "Selesai" },
  rejected: { icon: "❌", label: "Ditolak" },
  cancel: { icon: "🚫", label: "Batal" },
};

function recapDay(day: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(day);
}

function recapStamp(): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function handledLine(s: {
  taken: number;
  done: number;
  rejected: number;
  inProcess: number;
}): string {
  return `ambil ${s.taken} · selesai ${s.done} · tolak ${s.rejected} · proses ${s.inProcess}`;
}

function handleSuffix(handle: string | null): string {
  if (!handle) return "";
  return ` ${escapeHtml(handle.startsWith("@") ? handle : `@${handle}`)}`;
}

const recapClock = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** `1. [15:02] 359760544287879 ✅`, capped so a busy day stays under Telegram's 4096-char limit. */
function recapOrderLines(
  orders: Array<{ at: Date; imei: string; status: string }>,
  max: number,
): string[] {
  const shown = orders.slice(0, max);
  const lines = shown.map((o, i) => {
    const icon = RECAP_STATUS[o.status]?.icon ?? "•";
    return `${i + 1}. [${recapClock.format(o.at).replace(".", ":")}] <code>${escapeHtml(o.imei)}</code> ${icon}`;
  });
  if (orders.length > shown.length) {
    lines.push(`<i>…dan ${orders.length - shown.length} order lainnya</i>`);
  }
  return lines;
}

function shortDay(day: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(day);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")}`;
}

/** Sent to each admin's own chat when a Super Admin runs /rekaporder. */
export function adminOrderRecapHtml(input: {
  day: Date;
  fullName: string;
  taken: number;
  done: number;
  rejected: number;
  inProcess: number;
  orders: Array<{ at: Date; imei: string; status: string }>;
}): string {
  return [
    "📋 <b>Rekap Order Anda</b>",
    `Halo <b>${escapeHtml(input.fullName)}</b>, berikut rekap dari Super Admin.`,
    "",
    `🗓️ Total registrasi hari ini ${escapeHtml(shortDay(input.day))}: <b>${input.orders.length}</b>`,
    handledLine(input),
    "",
    ...recapOrderLines(input.orders, 80),
    "",
    `<i>✅ selesai · 🛠️ dikerjakan · ❌ ditolak · 🚫 batal · per ${recapStamp()} WIB</i>`,
  ].join("\n");
}

export function superAdminRecapHtml(input: {
  day: Date;
  created: {
    total: number;
    web: number;
    telegram: number;
    viaTelegram: number;
    viaWhatsapp: number;
    byStatus: Partial<Record<string, number>>;
  };
  revenue: { amount: number; payments: number };
  handled: { taken: number; done: number; rejected: number; inProcess: number };
  queue: number;
  whatsapp: {
    taken: number;
    done: number;
    rejected: number;
    inProcess: number;
    queue: number;
    orders: Array<{ at: Date; imei: string; status: string }>;
  };
  perAdmin: Array<{
    fullName: string;
    telegramHandle: string | null;
    taken: number;
    done: number;
    rejected: number;
    inProcess: number;
    orders: Array<{ at: Date; imei: string; status: string }>;
  }>;
}): string {
  const count = (status: string) => input.created.byStatus[status] ?? 0;
  const orDash = (n: number) => (n > 0 ? `<b>${n}</b>` : "-");

  const adminBlocks = input.perAdmin.map((a) =>
    [
      `• <b>${escapeHtml(a.fullName)}</b>${handleSuffix(a.telegramHandle)}`,
      handledLine(a),
      ...recapOrderLines(a.orders, 40),
    ].join("\n"),
  );

  return [
    "📊 <b>Rekap Order Hari Ini</b>",
    `<i>${escapeHtml(recapDay(input.day))} · per ${recapStamp()} WIB</i>`,
    "",
    `🧾 Order masuk: <b>${input.created.total}</b> (Web ${input.created.web} · Telegram ${input.created.telegram})`,
    `🔀 Jalur proses: Telegram ${input.created.viaTelegram} · WhatsApp ${input.created.viaWhatsapp}`,
    `✅ Selesai: ${orDash(count("done"))}`,
    `🚫 Batal: ${orDash(count("cancel"))}`,
    `💰 Pendapatan: <b>${escapeHtml(formatRp(input.revenue.amount))}</b> dari ${input.revenue.payments} pembayaran`,
    "",
    "",
    "👥 <b>Per admin</b> (jalur Telegram)",
    adminBlocks.length
      ? adminBlocks.join("\n\n")
      : "<i>Belum ada aktivitas admin hari ini.</i>",
    "",
    "",
    "💬 <b>WhatsApp · Roamercheck</b>",
    handledLine(input.whatsapp),
    `📥 Antrean: ${orDash(input.whatsapp.queue)}`,
    ...(input.whatsapp.orders.length
      ? recapOrderLines(input.whatsapp.orders, 40)
      : ["<i>Belum ada order WhatsApp yang diproses hari ini.</i>"]),
  ].join("\n");
}

export function operatorRecapHtml(input: {
  day: Date;
  stats: { taken: number; done: number; rejected: number; inProcess: number };
  queue: number;
  orders: Array<{ at: Date; imei: string; status: string }>;
}): string {
  const orderLines = recapOrderLines(input.orders, 80);
  return [
    "📊 <b>Rekap Anda Hari Ini</b>",
    `<i>${escapeHtml(recapDay(input.day))} · per ${recapStamp()} WIB</i>`,
    "",
    row("🛠️", "Diambil", String(input.stats.taken)),
    row("✅", "Selesai", String(input.stats.done)),
    row("❌", "Ditolak", String(input.stats.rejected)),
    row("⏱️", "Masih dikerjakan", String(input.stats.inProcess)),
    row("📥", "Antrean menunggu diambil", String(input.queue)),
    "",
    "📋 <b>Order yang Anda tangani</b>",
    ...(orderLines.length ? orderLines : ["<i>Belum ada order hari ini.</i>"]),
  ].join("\n");
}

export function inviteClaimPendingHtml(fullName: string): string {
  return [
    "⏳ <b>Undangan diterima</b>",
    `Permintaan menautkan Telegram ini ke akun operator <b>${escapeHtml(fullName)}</b> sudah dikirim ke Super Admin.`,
    "",
    "<i>Anda akan mendapat pesan di sini setelah disetujui.</i>",
  ].join("\n");
}

export function inviteFailedHtml(reason: string): string {
  return [
    "⚠️ <b>Undangan tidak dapat dipakai</b>",
    escapeHtml(reason),
    "",
    "<i>Minta Super Admin membuat link undangan baru.</i>",
  ].join("\n");
}

export function inviteApprovalRequestHtml(input: {
  adminUsername: string;
  adminFullName: string;
  telegramUserId: string;
  telegramUsername?: string | null;
  telegramName?: string | null;
}): string {
  return [
    "🔐 <b>Permintaan tautan operator</b>",
    "",
    row("🛡️", "Akun", `${input.adminFullName} (@${input.adminUsername})`),
    row(
      "💬",
      "Telegram",
      input.telegramUsername ? `@${input.telegramUsername}` : "tanpa username",
    ),
    ...(input.telegramName ? [row("🪪", "Nama", input.telegramName)] : []),
    row("#️⃣", "Telegram ID", input.telegramUserId, true),
    "",
    "<i>Setujui hanya jika ini benar akun Telegram operator tersebut.</i>",
  ].join("\n");
}

export function inviteDecidedHtml(input: {
  approved: boolean;
  adminUsername: string;
  deciderUsername: string;
}): string {
  return [
    input.approved
      ? "✅ <b>Tautan operator disetujui</b>"
      : "🚫 <b>Tautan operator ditolak</b>",
    row("🛡️", "Akun", `@${input.adminUsername}`),
    row("👤", "Oleh", `@${input.deciderUsername}`),
  ].join("\n");
}

export function inviteApprovedOperatorHtml(fullName: string): string {
  return [
    "✅ <b>Akun operator aktif</b>",
    `Halo <b>${escapeHtml(fullName)}</b>, Telegram Anda sudah tertaut.`,
    "",
    "Order baru akan masuk ke chat ini. Proses lewat tombol <b>Terima</b>, <b>Tolak</b>, dan <b>Done</b>.",
    "Ketik /riwayat untuk melihat antrean Anda.",
  ].join("\n");
}

export function inviteRejectedOperatorHtml(): string {
  return [
    "🚫 <b>Permintaan ditolak</b>",
    "Super Admin menolak menautkan Telegram ini.",
  ].join("\n");
}

export function operatorUnlinkedHtml(): string {
  return [
    "🔌 <b>Tautan operator dicabut</b>",
    "Telegram ini tidak lagi menerima order ZITTOSITE.",
  ].join("\n");
}

export function saldoMemberHtml(input: {
  balance: number;
  portalUrl: string;
}): string {
  return [
    "💎 <b>Saldo akun</b>",
    "",
    row("💰", "Saldo", formatRp(input.balance)),
    "",
    `🌐 Portal: ${escapeHtml(input.portalUrl)}`,
  ].join("\n");
}

export function saldoAdminHtml(): string {
  return [
    "💎 <b>Saldo akun</b>",
    "",
    "<i>Saldo hanya untuk akun user. Admin memakai Telegram untuk notifikasi.</i>",
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

export function imeiHtml(imei: string): string {
  return `<code>${escapeHtml(imei)}</code>`;
}

export function formatRp(n: number): string {
  return `Rp${n.toLocaleString("id-ID")}`;
}

/** Customer and price rows shown on Super Admin cards only. */
export type CardCustomer = { username: string; channel: string; price: number };

function customerLines(customer?: CardCustomer): string[] {
  return customer
    ? [
        row("👤", "User", customer.username, true),
        row("📡", "Via", customer.channel),
        row("💰", "Harga", formatRp(customer.price)),
      ]
    : [];
}

export function newOrderAdminHtml(input: {
  orderId: string;
  imei: string;
  serviceName: string;
  customer?: CardCustomer;
  viaWhatsapp?: boolean;
}): string {
  return [
    "🆕 <b>ORDER BARU</b>",
    "",
    row("🎫", "Order ID", input.orderId, true),
    ...customerLines(input.customer),
    row("📱", "IMEI", input.imei, true),
    row("📦", "Layanan", input.serviceName),
    ...(input.viaWhatsapp
      ? [row("🔀", "Jalur", "WhatsApp (Roamercheck)")]
      : []),
    row("🟢", "Status", "waiting_action"),
  ].join("\n");
}

const FOLLOW_UP_TITLE = {
  taken: "🛠️ <b>Order diambil admin</b>",
  rejected: "❌ <b>Order ditolak admin</b>",
  done: "✅ <b>Order diselesaikan admin</b>",
} as const;

export function superAdminFollowUpHtml(input: {
  kind: keyof typeof FOLLOW_UP_TITLE;
  orderId: string;
  imei: string;
  serviceName: string;
  customer?: { username: string; price: number };
  adminUsername: string;
  adminFullName: string;
  note?: string;
}): string {
  return [
    FOLLOW_UP_TITLE[input.kind],
    "",
    row("🎫", "Order ID", input.orderId, true),
    row("📱", "IMEI", input.imei, true),
    ...(input.customer
      ? [row("👤", "User", input.customer.username, true)]
      : []),
    row("📦", "Layanan", input.serviceName),
    ...(input.customer
      ? [row("💰", "Harga", formatRp(input.customer.price))]
      : []),
    row("👷", "Admin", `${input.adminUsername} (${input.adminFullName})`),
    ...(input.note
      ? [row("📝", input.kind === "done" ? "Hasil" : "Alasan", input.note)]
      : []),
  ].join("\n");
}

export function orderCardTakenHtml(input: {
  orderId: string;
  imei: string;
  serviceName: string;
  customer?: CardCustomer;
  actorName: string;
}): string {
  return [
    "🛠️ <b>IN PROCESS</b>",
    "",
    row("🎫", "Order ID", input.orderId, true),
    ...customerLines(input.customer),
    row("📱", "IMEI", input.imei, true),
    row("📦", "Layanan", input.serviceName),
    row("👷", "Diambil oleh", input.actorName),
  ].join("\n");
}

export function orderCardRejectedHtml(input: {
  orderId: string;
  imei: string;
  serviceName: string;
  customer?: CardCustomer;
  actorName: string;
  reason?: string;
}): string {
  return [
    "❌ <b>REJECTED</b>",
    "",
    row("🎫", "Order ID", input.orderId, true),
    ...customerLines(input.customer),
    row("📱", "IMEI", input.imei, true),
    row("📦", "Layanan", input.serviceName),
    row("👷", "Oleh", input.actorName),
    ...(input.reason ? [row("📝", "Alasan", input.reason)] : []),
  ].join("\n");
}

export function orderCardCancelledHtml(input: {
  orderId: string;
  imei: string;
  serviceName: string;
  customer?: CardCustomer;
  actorName: string;
  reason: string;
}): string {
  return [
    "🚫 <b>DIBATALKAN</b>",
    "",
    row("🎫", "Order ID", input.orderId, true),
    ...customerLines(input.customer),
    row("📱", "IMEI", input.imei, true),
    row("📦", "Layanan", input.serviceName),
    row("👤", "Oleh", input.actorName),
    row("📝", "Alasan", input.reason),
  ].join("\n");
}

export function orderCardDoneHtml(input: {
  orderId: string;
  imei: string;
  serviceName: string;
  customer?: CardCustomer;
  actorName: string;
  note: string;
}): string {
  return [
    "✅ <b>DONE</b>",
    "",
    row("🎫", "Order ID", input.orderId, true),
    ...customerLines(input.customer),
    row("📱", "IMEI", input.imei, true),
    row("📦", "Layanan", input.serviceName),
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
        `${i + 1}. <code>${escapeHtml(o.orderId)}</code> — ${escapeHtml(o.serviceName)}\n   ${escapeHtml(o.status)} · ${imeiHtml(o.imei)}`,
    ),
  ].join("\n");
}

export type BulkItem = { orderId: string; imei: string };

/** Order ID row for a single order, or one line per IMEI for a bulk order. */
function orderIdLines(orderId: string, items?: BulkItem[]): string[] {
  if (!items || items.length < 2) return [row("🎫", "Order ID", orderId, true)];
  return [
    `📦 <b>Bulk ${items.length} IMEI</b> (1 QRIS)`,
    ...items.map(
      (item) =>
        `• <code>${escapeHtml(item.orderId)}</code> · <code>${escapeHtml(item.imei)}</code>`,
    ),
  ];
}

function balanceUsedLines(balanceUsed: number | undefined): string[] {
  return balanceUsed && balanceUsed > 0
    ? [row("💳", "Dipotong saldo", formatRp(balanceUsed))]
    : [];
}

export function orderPaidByBalanceHtml(input: {
  orderId: string;
  amount: number;
  items?: BulkItem[];
}): string {
  return [
    "✅ <b>Order dibuat &amp; lunas</b>",
    "",
    ...orderIdLines(input.orderId, input.items),
    row("💳", "Dibayar dengan saldo", formatRp(input.amount)),
    "",
    "Order Anda langsung masuk antrean admin. Kami kabari lagi saat mulai dikerjakan.",
  ].join("\n");
}

export function orderCreatedHtml(input: {
  orderId: string;
  payUrl: string;
  amount: number;
  balanceUsed?: number;
  items?: BulkItem[];
}): string {
  return [
    "✅ <b>Order dibuat</b>",
    "",
    ...orderIdLines(input.orderId, input.items),
    ...balanceUsedLines(input.balanceUsed),
    row("💰", "Tagihan", formatRp(input.amount)),
    "",
    "Bayar di portal:",
    escapeHtml(input.payUrl),
  ].join("\n");
}

export function pendingOrderHtml(input: {
  orderId: string;
  amount: number;
  balanceUsed?: number;
  expiresAt: Date | null;
  items?: BulkItem[];
}): string {
  const until = input.expiresAt
    ? new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
      }).format(input.expiresAt)
    : null;
  return [
    "⏳ <b>Masih ada order menunggu pembayaran</b>",
    "",
    ...orderIdLines(input.orderId, input.items),
    ...balanceUsedLines(input.balanceUsed),
    row("💰", "Tagihan", formatRp(input.amount)),
    ...(until ? [row("⏰", "Bayar sebelum", `${until} WIB`)] : []),
    "",
    "Selesaikan pembayarannya, atau batalkan untuk membuat order baru.",
  ].join("\n");
}

export function cancelConfirmHtml(orderId: string, bulkCount = 1): string {
  if (bulkCount > 1) {
    return [
      `Batalkan order <code>${escapeHtml(orderId)}</code>?`,
      `Order ini bagian dari bulk ${bulkCount} IMEI dengan 1 QRIS, jadi <b>semua ${bulkCount} order</b> ikut dibatalkan.`,
    ].join("\n");
  }
  return [
    `Batalkan order <code>${escapeHtml(orderId)}</code>?`,
    "QRIS untuk order ini tidak bisa dipakai lagi setelah dibatalkan.",
  ].join("\n");
}

/** Caption for the QRIS photo; Telegram caps captions at 1024 characters. */
const RESULT_LABEL: Record<string, string> = {
  success: "✅ Berhasil",
  failed: "❌ Gagal",
};

type UserOrderNotice =
  | { kind: "paid"; orderId: string; imei: string; serviceName: string }
  | { kind: "taken"; orderId: string }
  | { kind: "rejected"; orderId: string; reason?: string; refund?: number }
  | {
      kind: "done";
      orderId: string;
      resultStatus: string;
      note: string;
      refund?: number;
    }
  | {
      kind: "cancelled";
      orderId: string;
      reason: string;
      wasPaid: boolean;
      refund?: number;
    }
  | { kind: "expired"; orderId: string }
  | { kind: "late_payment"; orderId: string; refund: number };

function refundLines(amount: number | undefined): string[] {
  return amount && amount > 0
    ? ["", `💳 Dana <b>${formatRp(amount)}</b> sudah dikembalikan ke saldo akun Anda.`]
    : [];
}

/** Status updates sent to the customer's own chat. */
export function userOrderNoticeHtml(notice: UserOrderNotice): string {
  const id = row("🎫", "Order ID", notice.orderId, true);
  switch (notice.kind) {
    case "paid":
      return [
        "✅ <b>Pembayaran diterima</b>",
        "",
        id,
        row("📦", "Layanan", notice.serviceName),
        row("📱", "IMEI", notice.imei, true),
        "",
        "Order Anda masuk antrean admin. Kami kabari lagi saat mulai dikerjakan.",
      ].join("\n");
    case "taken":
      return [
        "🛠️ <b>Order sedang dikerjakan</b>",
        "",
        id,
        "",
        "Admin sudah mengambil order Anda. Hasilnya dikirim ke chat ini.",
      ].join("\n");
    case "rejected":
      return [
        "❌ <b>Order ditolak</b>",
        "",
        id,
        ...(notice.reason ? [row("📝", "Alasan", notice.reason)] : []),
        ...refundLines(notice.refund),
      ].join("\n");
    case "done":
      return [
        "🎉 <b>Order selesai</b>",
        "",
        id,
        row("📊", "Hasil", RESULT_LABEL[notice.resultStatus] ?? notice.resultStatus),
        ...(notice.note ? [row("📝", "Catatan", notice.note)] : []),
        ...refundLines(notice.refund),
      ].join("\n");
    case "cancelled":
      return [
        "🚫 <b>Order dibatalkan admin</b>",
        "",
        id,
        row("📝", "Alasan", notice.reason),
        ...(notice.refund
          ? refundLines(notice.refund)
          : notice.wasPaid
            ? ["", "Pembayaran Anda sudah kami terima. Hubungi support untuk pengembalian dana."]
            : []),
      ].join("\n");
    case "late_payment":
      return [
        "💳 <b>Pembayaran terlambat diterima</b>",
        "",
        id,
        "",
        "Pembayaran masuk setelah order dibatalkan.",
        ...refundLines(notice.refund),
      ].join("\n");
    case "expired":
      return [
        "⌛ <b>Order dibatalkan otomatis</b>",
        "",
        id,
        "",
        "Batas waktu pembayaran sudah habis.",
        "Ketik /order untuk membuat order baru.",
      ].join("\n");
  }
}

export function orderQrisCaptionHtml(input: {
  orderId: string;
  amount: number;
  balanceUsed?: number;
  expiresAt: Date;
  items?: BulkItem[];
}): string {
  const until = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).format(input.expiresAt);
  return [
    "✅ <b>Order dibuat</b>",
    "",
    ...orderIdLines(input.orderId, input.items),
    ...balanceUsedLines(input.balanceUsed),
    row("💰", "Tagihan", formatRp(input.amount)),
    row("⏰", "Bayar sebelum", `${until} WIB`),
    "",
    "Scan QRIS di atas dengan m-banking atau e-wallet.",
    `Bayar <b>tepat ${escapeHtml(formatRp(input.amount))}</b> agar terdeteksi otomatis.`,
    "Notifikasi masuk di chat ini setelah pembayaran diterima.",
    "Lewat batas waktu, order dibatalkan otomatis.",
  ].join("\n");
}

