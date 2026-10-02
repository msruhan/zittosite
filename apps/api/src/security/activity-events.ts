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
  f.channel === "telegram"
    ? "Telegram"
    : f.channel === "web"
      ? "website"
      : f.channel === "api"
        ? "API"
        : "";
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
  "balance.topup_created": {
    category: "payment",
    label: "Topup dibuat",
    summary: ({ fields, target }) =>
      `Membuat topup ${fields.invoiceId} sebesar ${rp(fields.amount)} lewat ${
        fields.channel === "telegram" ? "Telegram" : "website"
      }${target ? ` (${target})` : ""}`,
  },
  "balance.topup_paid": {
    category: "payment",
    label: "Topup berhasil",
    summary: ({ fields, target }) =>
      `Topup ${fields.invoiceId} sebesar ${rp(fields.amount)} masuk ke saldo${
        target ? ` ${target}` : ""
      }${fields.method ? ` via ${fields.method}` : ""}`,
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
  "admin.order.reason_updated": {
    category: "order",
    label: "Keterangan order diubah",
    summary: ({ fields }) =>
      fields.reason
        ? `Mengubah keterangan order ${fields.orderId} menjadi: ${String(fields.reason)}`
        : `Menghapus keterangan order ${fields.orderId}`,
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
        fields.role ? `role ${fields.role === "testing" ? "Testing" : "User"}` : "",
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
  "admin.group.created": {
    category: "user",
    label: "Group dibuat",
    summary: ({ fields }) => `Membuat group ${fields.groupName ?? ""}`,
  },
  "admin.group.updated": {
    category: "user",
    label: "Group diperbarui",
    summary: ({ fields }) =>
      `Memperbarui group ${fields.groupName ?? ""}${fields.pricesChanged ? " (harga)" : ""}`,
  },
  "admin.group.members_updated": {
    category: "user",
    label: "Member group diubah",
    summary: ({ fields }) =>
      `Mengatur member group ${fields.groupName ?? ""} (${fields.members ?? 0} user)`,
  },
  "admin.group.deleted": {
    category: "user",
    label: "Group dihapus",
    summary: ({ fields }) => `Menghapus group ${fields.groupName ?? ""}`,
  },
  "admin.running_ad.created": {
    category: "admin",
    label: "Ads Runner ditambahkan",
    summary: ({ fields }) => `Menambahkan ads runner "${fields.text ?? ""}"`,
  },
  "admin.running_ad.updated": {
    category: "admin",
    label: "Ads Runner diperbarui",
    summary: ({ fields }) =>
      typeof fields.active === "boolean"
        ? `${fields.active ? "Menampilkan" : "Menyembunyikan"} ads runner "${fields.text ?? ""}"`
        : `Memperbarui ads runner "${fields.text ?? ""}"`,
  },
  "admin.running_ad.deleted": {
    category: "admin",
    label: "Ads Runner dihapus",
    summary: ({ fields }) => `Menghapus ads runner "${fields.text ?? ""}"`,
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
  "admin.service.deleted": {
    category: "service",
    label: "Layanan dihapus",
    summary: ({ fields }) => `Menghapus layanan ${fields.serviceName ?? fields.serviceId ?? ""}`,
  },
  "admin.service_group.created": {
    category: "service",
    label: "Grup layanan dibuat",
    summary: ({ fields }) =>
      `Membuat grup layanan "${fields.groupName ?? ""}" (${fields.serviceCount ?? 0} layanan)`,
  },
  "admin.service_group.updated": {
    category: "service",
    label: "Grup layanan diperbarui",
    summary: ({ fields }) => `Memperbarui grup layanan "${fields.groupName ?? ""}"`,
  },
  "admin.service_group.deleted": {
    category: "service",
    label: "Grup layanan dihapus",
    summary: ({ fields }) => `Menghapus grup layanan "${fields.groupName ?? ""}"`,
  },
  "admin.service_group.price_adjusted": {
    category: "service",
    label: "Harga grup diubah",
    summary: ({ fields }) =>
      `Mengubah harga ${fields.serviceCount ?? 0} layanan di grup "${fields.groupName ?? ""}" (${fields.adjustment ?? ""})`,
  },
  "admin.usd_rate.updated": {
    category: "service",
    label: "Kurs USD diubah",
    summary: ({ fields }) =>
      `Mengubah kurs Layanan Spesial dari ${rp(fields.previous)} ke ${rp(fields.rate)} per $1 (${fields.serviceCount ?? 0} layanan dihitung ulang)`,
  },
  "admin.supplier.created": {
    category: "service",
    label: "Supplier API ditambahkan",
    summary: ({ fields }) => `Menambahkan supplier ${fields.supplierName ?? ""} (${fields.baseUrl ?? ""})`,
  },
  "admin.supplier.updated": {
    category: "service",
    label: "Supplier API diperbarui",
    summary: ({ fields }) =>
      typeof fields.active === "boolean"
        ? `${fields.active ? "Mengaktifkan" : "Menonaktifkan"} supplier ${fields.supplierName ?? ""}`
        : `Memperbarui supplier ${fields.supplierName ?? ""}${fields.keyRotated ? " (API key diganti)" : ""}`,
  },
  "admin.supplier.deleted": {
    category: "service",
    label: "Supplier API dihapus",
    summary: ({ fields }) => `Menghapus supplier ${fields.supplierName ?? ""}`,
  },
  "api.key.created": {
    category: "security",
    label: "API key dibuat",
    summary: ({ fields }) => `Membuat API key "${fields.keyName ?? ""}"`,
  },
  "api.key.revoked": {
    category: "security",
    label: "API key dicabut",
    summary: ({ fields }) => `Mencabut API key "${fields.keyName ?? ""}"`,
  },
  "api.access.toggled": {
    category: "user",
    label: "Akses API diubah",
    summary: ({ fields, target }) =>
      `${fields.enabled ? "Mengaktifkan" : "Menonaktifkan"} akses API untuk ${target ?? "user"}`,
  },
  "api.webhook.updated": {
    category: "security",
    label: "Webhook API diubah",
    summary: ({ fields }) =>
      fields.secretRotated
        ? "Membuat ulang secret webhook API"
        : `Mengatur webhook API ke ${fields.url ?? "-"}${fields.active === false ? " (nonaktif)" : ""}`,
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
