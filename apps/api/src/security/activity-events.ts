export type ActivityCategory =
  | "auth"
  | "order"
  | "payment"
  | "user"
  | "admin"
  | "service"
  | "telegram"
  | "notification"
  | "security";

type Fields = Record<string, string | number | boolean | null | undefined>;

export type SummaryContext = {
  fields: Fields;
  /** Resolved name of the user/admin the event is about, when it differs from the actor. */
  target: string | null;
};

type EventInfo = {
  category: ActivityCategory;
  label: string;
  summary: (ctx: SummaryContext) => string;
};

const rp = (n: unknown) =>
  typeof n === "number" ? `Rp${n.toLocaleString("id-ID")}` : "";
const via = (f: Fields) =>
  f.channel === "telegram" ? "Telegram" : f.channel === "web" ? "website" : "";
const withReason = (base: string, reason: unknown) =>
  reason ? `${base} — alasan: ${String(reason)}` : base;
const orderLine = (f: Fields) =>
  [f.orderId, f.serviceName ? `(${f.serviceName})` : "", f.imei ? `IMEI ${f.imei}` : ""]
    .filter(Boolean)
    .join(" ");

const REFUND_REASON: Record<string, string> = {
  order_rejected: "order ditolak",
  order_cancelled: "order dibatalkan",
  order_failed: "hasil gagal",
  late_payment: "pembayaran terlambat",
};

export const ACTIVITY_EVENTS = {
  "auth.user.login_success": {
    category: "auth",
    label: "User login",
    summary: () => "Login ke portal user",
  },
  "auth.user.login_failed": {
    category: "security",
    label: "Login user gagal",
    summary: ({ fields }) => `Percobaan login gagal untuk username "${fields.username ?? "-"}"`,
  },
  "auth.user.locked": {
    category: "security",
    label: "Login user dikunci",
    summary: ({ fields }) =>
      `Terlalu banyak percobaan gagal, username "${fields.username ?? "-"}" dikunci sementara`,
  },
  "auth.user.logout": {
    category: "auth",
    label: "User logout",
    summary: () => "Logout dari portal user",
  },
  "auth.user.password_changed": {
    category: "security",
    label: "User ganti password",
    summary: () => "Mengganti password akun",
  },
  "auth.admin.login_success": {
    category: "auth",
    label: "Admin login",
    summary: () => "Login ke panel admin",
  },
  "auth.admin.login_failed": {
    category: "security",
    label: "Login admin gagal",
    summary: ({ fields }) => `Percobaan login gagal untuk username "${fields.username ?? "-"}"`,
  },
  "auth.admin.login_denied_operator": {
    category: "security",
    label: "Login operator ditolak",
    summary: () => "Operator mencoba login ke website (operator hanya lewat Telegram)",
  },
  "auth.admin.totp_failed": {
    category: "security",
    label: "Kode 2FA salah",
    summary: ({ fields }) =>
      fields.replayed ? "Kode Google Authenticator dipakai ulang" : "Kode Google Authenticator salah",
  },
  "auth.admin.locked": {
    category: "security",
    label: "Login admin dikunci",
    summary: ({ fields }) =>
      `Terlalu banyak percobaan gagal${fields.username ? ` untuk "${fields.username}"` : ""}, dikunci sementara`,
  },
  "auth.admin.logout": {
    category: "auth",
    label: "Admin logout",
    summary: () => "Logout dari panel admin",
  },
  "auth.admin.password_changed": {
    category: "security",
    label: "Admin ganti password",
    summary: () => "Mengganti password akun",
  },
  "auth.admin.totp_enabled": {
    category: "security",
    label: "2FA diaktifkan",
    summary: () => "Mengaktifkan Google Authenticator",
  },
  "auth.admin.totp_disabled": {
    category: "security",
    label: "2FA dinonaktifkan",
    summary: () => "Menonaktifkan Google Authenticator",
  },
  "order.created": {
    category: "order",
    label: "Order baru",
    summary: ({ fields }) =>
      `Membuat order ${orderLine(fields)} · ${rp(fields.price)}${via(fields) ? ` via ${via(fields)}` : ""}`,
  },
  "order.cancelled_by_user": {
    category: "order",
    label: "Order dibatalkan user",
    summary: ({ fields }) => `Membatalkan order ${fields.orderId} sebelum dibayar`,
  },
  "order.expired": {
    category: "order",
    label: "Order kedaluwarsa",
    summary: ({ fields }) =>
      `Order ${fields.orderId} dibatalkan otomatis karena tidak dibayar${fields.source === "gateway" ? " (dari payment gateway)" : ""}`,
  },
  "order.taken": {
    category: "order",
    label: "Order diproses",
    summary: ({ fields }) => `Mengambil dan memproses order ${orderLine(fields)}`,
  },
  "order.rejected": {
    category: "order",
    label: "Order ditolak",
    summary: ({ fields }) => withReason(`Menolak order ${orderLine(fields)}`, fields.reason),
  },
  "order.done": {
    category: "order",
    label: "Order selesai",
    summary: ({ fields }) => `Menyelesaikan order ${orderLine(fields)}`,
  },
  "payment.paid": {
    category: "payment",
    label: "Pembayaran berhasil",
    summary: ({ fields, target }) =>
      `Pembayaran ${rp(fields.amount)} untuk order ${fields.orderId} diterima${
        fields.method ? ` via ${fields.method}` : ""
      }${target ? ` dari ${target}` : ""}`,
  },
  "payment.late": {
    category: "payment",
    label: "Pembayaran terlambat",
    summary: ({ fields }) =>
      `Pembayaran ${rp(fields.amount)} untuk order ${fields.orderId} masuk setelah invoice ${fields.invoiceStatus} — dimasukkan ke saldo user`,
  },
  "balance.refunded": {
    category: "payment",
    label: "Refund ke saldo",
    summary: ({ fields, target }) =>
      `${rp(fields.amount)} dari order ${fields.orderId} dikembalikan ke saldo${
        target ? ` ${target}` : ""
      } (${REFUND_REASON[String(fields.reason)] ?? fields.reason})`,
  },
  "balance.refund_reversed": {
    category: "payment",
    label: "Refund ditarik",
    summary: ({ fields, target }) =>
      `Refund ${rp(fields.amount)} order ${fields.orderId} ditarik dari saldo${
        target ? ` ${target}` : ""
      } karena status diubah menjadi ${fields.status}`,
  },
  "admin.user.balance_adjusted": {
    category: "user",
    label: "Saldo diubah manual",
    summary: ({ fields, target }) => {
      const amount = typeof fields.amount === "number" ? fields.amount : 0;
      return withReason(
        `${amount >= 0 ? "Menambah" : "Mengurangi"} saldo ${target ?? "user"} sebesar ${rp(
          Math.abs(amount),
        )}`,
        fields.note,
      );
    },
  },
  "notify.whatsapp_failed": {
    category: "notification",
    label: "Notifikasi WhatsApp gagal",
    summary: ({ fields }) =>
      `Notifikasi grup WhatsApp untuk ${fields.invoiceId ?? `order ${fields.orderId}`} gagal terkirim setelah ${fields.attempts} percobaan${
        fields.error ? ` — ${String(fields.error)}` : ""
      }`,
  },
  "admin.order.cancelled": {
    category: "order",
    label: "Order dibatalkan admin",
    summary: ({ fields }) => withReason(`Membatalkan order ${fields.orderId}`, fields.reason),
  },
  "admin.order.status_override": {
    category: "order",
    label: "Status order diubah",
    summary: ({ fields }) => `Mengubah status order ${fields.orderId} menjadi ${fields.status}`,
  },
  "admin.user.created": {
    category: "user",
    label: "User dibuat",
    summary: ({ target }) => `Membuat akun user ${target ?? ""}`.trim(),
  },
  "admin.user.updated": {
    category: "user",
    label: "User diperbarui",
    summary: ({ fields, target }) => {
      const extra = [
        fields.passwordReset ? "reset password" : "",
        fields.status ? `status ${fields.status}` : "",
      ].filter(Boolean);
      return `Memperbarui data user ${target ?? ""}${extra.length ? ` (${extra.join(", ")})` : ""}`;
    },
  },
  "admin.user.deleted": {
    category: "user",
    label: "User dihapus",
    summary: ({ fields, target }) =>
      fields.hardDeleted === false
        ? `Menonaktifkan user ${target ?? ""} (punya riwayat order)`
        : `Menghapus user ${target ?? fields.userId ?? ""}`,
  },
  "admin.admin.created": {
    category: "admin",
    label: "Admin dibuat",
    summary: ({ fields, target }) =>
      `Membuat akun ${fields.role === "super_admin" ? "Super Admin" : "operator"} ${target ?? ""}`.trim(),
  },
  "admin.admin.updated": {
    category: "admin",
    label: "Admin diperbarui",
    summary: ({ target }) => `Memperbarui akun admin ${target ?? ""}`.trim(),
  },
  "admin.admin.deleted": {
    category: "admin",
    label: "Admin dihapus",
    summary: ({ target, fields }) => `Menghapus akun admin ${target ?? fields.adminId ?? ""}`,
  },
  "admin.service.created": {
    category: "service",
    label: "Layanan dibuat",
    summary: ({ fields }) => `Membuat layanan ${fields.serviceName ?? fields.serviceId ?? ""}`,
  },
  "admin.service.updated": {
    category: "service",
    label: "Layanan diperbarui",
    summary: ({ fields }) =>
      typeof fields.active === "boolean"
        ? `Mengubah layanan ${fields.serviceName ?? ""} menjadi ${fields.active ? "online" : "offline"}`
        : `Memperbarui layanan ${fields.serviceName ?? fields.serviceId ?? ""}`,
  },
  "admin.telegram.invite_created": {
    category: "telegram",
    label: "Undangan Telegram dibuat",
    summary: ({ target }) => `Membuat link undangan Telegram untuk ${target ?? "operator"}`,
  },
  "admin.telegram.invite_revoked": {
    category: "telegram",
    label: "Undangan Telegram dicabut",
    summary: ({ target }) => `Mencabut undangan Telegram ${target ?? ""}`.trim(),
  },
  "admin.telegram.invite_claimed": {
    category: "telegram",
    label: "Undangan Telegram dibuka",
    summary: () => "Membuka link undangan dan meminta persetujuan tautan Telegram",
  },
  "admin.telegram.invite_approved": {
    category: "telegram",
    label: "Tautan Telegram disetujui",
    summary: ({ target }) => `Menyetujui tautan Telegram untuk ${target ?? "operator"}`,
  },
  "admin.telegram.invite_rejected": {
    category: "telegram",
    label: "Tautan Telegram ditolak",
    summary: ({ target }) => `Menolak tautan Telegram untuk ${target ?? "operator"}`,
  },
  "admin.telegram.unlinked": {
    category: "telegram",
    label: "Telegram dilepas",
    summary: ({ target }) => `Melepas tautan Telegram ${target ?? ""}`.trim(),
  },
} satisfies Record<string, EventInfo>;

export type AuditEvent = keyof typeof ACTIVITY_EVENTS;
