import type { UserMenus } from "../orders/user-menus";
import { formatRp } from "../telegram/telegram-messages";

/** The slice of `OrdersService.listServices` rows the WhatsApp menu needs. */
export type WaService = {
  code: string;
  name: string;
  price: number;
  inputType: string;
  menu: { slug: string } | null;
  /** Plain-text service description; shown on the ask-IMEI step like Telegram. */
  description?: string | null;
};

export type WaMenuEntry =
  | { kind: "service"; code: string }
  | { kind: "history" }
  | { kind: "account" };

export type WaMenuSection = { title: string; services: WaService[] };

const byName = (a: WaService, b: WaService) => a.name.localeCompare(b.name);

/**
 * Only "Order IMEI" (manual services) and CEIR-style menus are offered on WhatsApp,
 * and only IMEI-input services; callers drop services that need extra fields.
 */
export function whatsappMenuSections(services: WaService[], menus: UserMenus): WaMenuSection[] {
  const imei = services.filter((service) => service.inputType === "imei");
  const sections: WaMenuSection[] = [];
  if (menus.order.enabled) {
    const manual = imei.filter((service) => !service.menu).sort(byName);
    if (manual.length) sections.push({ title: "📱 Order IMEI", services: manual });
  }
  for (const menu of menus.menus) {
    if (menu.style !== "ceir") continue;
    const inMenu = imei.filter((service) => service.menu?.slug === menu.slug).sort(byName);
    if (inMenu.length) sections.push({ title: `🔎 ${menu.label}`, services: inMenu });
  }
  return sections;
}

export function mainMenu(
  fullName: string,
  sections: WaMenuSection[],
): { text: string; entries: WaMenuEntry[] } {
  const entries: WaMenuEntry[] = [];
  const lines = [
    `👋 Halo *${fullName}*!`,
    "Selamat datang di layanan order *ZITTOSITE*.",
  ];
  for (const section of sections) {
    lines.push("", `*${section.title}*`);
    for (const service of section.services) {
      entries.push({ kind: "service", code: service.code });
      lines.push(`${entries.length}. ${service.name} — ${formatRp(service.price)}`);
    }
  }
  if (!sections.length) lines.push("", "_Belum ada layanan yang bisa dipesan lewat WhatsApp._");
  lines.push("", "*📋 Lainnya*");
  entries.push({ kind: "history" });
  lines.push(`${entries.length}. Riwayat Order Saya`);
  entries.push({ kind: "account" });
  lines.push(`${entries.length}. Akun & Informasi`);
  lines.push("", "Balas dengan *nomor menu* yang dipilih.");
  return { text: lines.join("\n"), entries };
}

/** 1-based menu number typed by the user, or null when it is not one of the options. */
export function parseChoice(text: string, count: number): number | null {
  const match = /^\s*(\d{1,3})\s*\.?\s*$/.exec(text);
  if (!match) return null;
  const choice = Number(match[1]);
  return choice >= 1 && choice <= count ? choice : null;
}

/** The only message that opens the bot; without an open conversation everything else is ignored. */
export function isMenuCommand(text: string): boolean {
  return /^\s*\/menu\s*$/i.test(text);
}

/** "0" inside a conversation: back to the menu (or cancel, on the confirmation step). */
export function isBackKeyword(text: string): boolean {
  return /^\s*0\s*$/.test(text);
}

export function isCancelKeyword(text: string): boolean {
  return /^\s*(batal|cancel)\s*$/i.test(text);
}

export function askImeiText(service: WaService, maxBulk: number): string {
  const description = String(service.description ?? "")
    .trim()
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  return [
    `📦 *${service.name}*`,
    `💰 Harga: *${formatRp(service.price)}* per IMEI`,
    "",
    ...(description.length
      ? [...description.map((line) => `> ${line}`), "", "✍️ Kirim *IMEI 15 digit* untuk melanjutkan."]
      : ["✍️ Kirim *IMEI 15 digit* perangkat."]),
    maxBulk > 1 ? `Untuk beberapa IMEI, tulis satu per baris (maksimal ${maxBulk}).` : null,
    "",
    "Balas *0* untuk kembali ke menu.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export function confirmOrderText(input: {
  serviceName: string;
  price: number;
  imeis: string[];
  description: string;
}): string {
  const total = input.price * input.imeis.length;
  const description = input.description.trim();
  return [
    "🧾 *Konfirmasi order*",
    "",
    `📦 *Layanan:* ${input.serviceName}`,
    ...(input.imeis.length === 1
      ? [`📱 *IMEI:* ${input.imeis[0]}`]
      : [`📱 *IMEI (${input.imeis.length}):*`, ...input.imeis.map((imei) => `• ${imei}`)]),
    `💰 *Total:* ${formatRp(total)}`,
    ...(description
      ? ["", "📝 *Deskripsi & persyaratan*", ...description.split("\n").map((line) => `> ${line}`)]
      : []),
    "",
    "1. Lanjut ke pembayaran",
    "0. Batal",
  ].join("\n");
}

export function pendingChoicesText(): string {
  return ["1. Kirim ulang pembayaran", "2. Batalkan order ini", "0. Kembali ke menu"].join("\n");
}

export function accountText(input: {
  fullName: string;
  username: string;
  balance: number;
  whatsappNumber: string;
}): string {
  return [
    "👤 *Akun & Informasi*",
    "",
    `🪪 *Nama:* ${input.fullName}`,
    `🔖 *Username:* ${input.username}`,
    `📞 *WhatsApp:* +${input.whatsappNumber}`,
    `💎 *Saldo:* ${formatRp(input.balance)}`,
    "",
    "Saldo dipakai otomatis saat order.",
    "",
    "Kirim */menu* untuk kembali.",
  ].join("\n");
}

export function unregisteredText(): string {
  return [
    "🔒 *Nomor belum terdaftar*",
    "",
    "Layanan order WhatsApp ini khusus untuk nomor yang sudah didaftarkan admin.",
    "Hubungi admin untuk mendaftarkan nomor Anda.",
  ].join("\n");
}
