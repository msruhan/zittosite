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

export function superAdminRecapHtml(input: {
  day: Date;
  created: {
    total: number;
    web: number;
    telegram: number;
    byStatus: Partial<Record<string, number>>;
  };
  revenue: { amount: number; payments: number };
  handled: { taken: number; done: number; rejected: number; inProcess: number };
  queue: number;
  perAdmin: Array<{
    fullName: string;
    telegramHandle: string | null;
    taken: number;
    done: number;
    rejected: number;
    inProcess: number;
  }>;
}): string {
  const statusLines = Object.entries(RECAP_STATUS)
    .filter(([status]) => (input.created.byStatus[status] ?? 0) > 0)
    .map(
      ([status, meta]) =>
        `   ${meta.icon} ${meta.label}: <b>${input.created.byStatus[status]}</b>`,
    );
  const adminLines = input.perAdmin.map((a) => {
    const handle = a.telegramHandle
      ? ` ${escapeHtml(a.telegramHandle.startsWith("@") ? a.telegramHandle : `@${a.telegramHandle}`)}`
      : "";
    return `• <b>${escapeHtml(a.fullName)}</b>${handle}\n   ${handledLine(a)}`;
  });

  return [
    "📊 <b>Rekap Order Hari Ini</b>",
    `<i>${escapeHtml(recapDay(input.day))} · per ${recapStamp()} WIB</i>`,
    "",
    row(
      "🧾",
      "Order masuk",
      `${input.created.total} (Web ${input.created.web} · Telegram ${input.created.telegram})`,
    ),
    ...statusLines,
    row(
      "💰",
      "Pendapatan",
      `${formatRp(input.revenue.amount)} dari ${input.revenue.payments} pembayaran`,
    ),
    "",
    "🛡️ <b>Tindak lanjut admin hari ini</b>",
    `   ${handledLine(input.handled)}`,
    row("📥", "Antrean belum diambil", String(input.queue)),
    "",
    "👥 <b>Per admin</b>",
    ...(adminLines.length ? adminLines : ["<i>Belum ada aktivitas admin hari ini.</i>"]),
  ].join("\n");
}

export function operatorRecapHtml(input: {
  day: Date;
  stats: { taken: number; done: number; rejected: number; inProcess: number };
  queue: number;
  orders: Array<{ orderId: string; serviceName: string; status: string; imei: string }>;
}): string {
  const orderLines = input.orders.map((o) => {
    const meta = RECAP_STATUS[o.status] ?? { icon: "•", label: o.status };
    return `${meta.icon} <code>${escapeHtml(o.orderId)}</code> — ${escapeHtml(o.serviceName)}\n   ${meta.label} · ${maskImeiHtml(o.imei)}`;
  });
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
  price: number;
  customer?: { username: string; channel: string };
}): string {
  return [
    "🆕 <b>ORDER BARU</b>",
    "",
    row("🎫", "Order ID", input.orderId, true),
    ...(input.customer
      ? [
          row("👤", "User", input.customer.username, true),
          row("📡", "Via", input.customer.channel),
        ]
      : []),
    row("📱", "IMEI", input.imei.slice(0, 3) + "X".repeat(Math.max(0, input.imei.length - 3)), true),
    row("📦", "Layanan", input.serviceName),
    row("💰", "Harga", formatRp(input.price)),
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
  customerUsername: string;
  serviceName: string;
  adminUsername: string;
  adminFullName: string;
  note?: string;
}): string {
  return [
    FOLLOW_UP_TITLE[input.kind],
    "",
    row("🎫", "Order ID", input.orderId, true),
    row("👤", "User", input.customerUsername, true),
    row("📦", "Layanan", input.serviceName),
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

/** Caption for the QRIS photo; Telegram caps captions at 1024 characters. */
export function orderQrisCaptionHtml(input: {
  orderId: string;
  amount: number;
  expiresAt: Date;
}): string {
  const until = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).format(input.expiresAt);
  return [
    "✅ <b>Order dibuat</b>",
    "",
    row("🎫", "Order ID", input.orderId, true),
    row("💰", "Tagihan", formatRp(input.amount)),
    row("⏰", "Bayar sebelum", `${until} WIB`),
    "",
    "Scan QRIS di atas dengan m-banking atau e-wallet.",
    `Bayar <b>tepat ${escapeHtml(formatRp(input.amount))}</b> agar terdeteksi otomatis.`,
    "Notifikasi masuk di chat ini setelah pembayaran diterima.",
  ].join("\n");
}

