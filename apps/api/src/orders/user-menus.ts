import { BadRequestException } from "@nestjs/common";
import type { MenuCurrency, MenuStyle } from "@prisma/client";
import type { MenuInfo } from "./supplier-routed";

/** SystemSetting key holding the manual "Order" menu's name and switch. */
export const USER_MENUS_KEY = "user_menus";

export type UserMenu = { label: string; enabled: boolean };

/** The manual Order menu (setting) followed by the supplier service menus (table), in sidebar order. */
export type UserMenus = { order: UserMenu; menus: MenuInfo[] };

export const MENU_LABEL_MAX = 30;
export const MAX_MENUS = 20;

export const DEFAULT_ORDER_MENU: UserMenu = { label: "Order", enabled: true };

/** Slugs the website and Telegram already use for something else. */
const RESERVED_SLUGS = new Set(["order", "supplier", "manual", "all"]);
/** Short enough for Telegram's 64-byte callback data (`uord:grp:<slug>:<groupId>:<page>`). */
export const SLUG_MAX = 20;
const SLUG = new RegExp(`^[a-z0-9][a-z0-9-]{0,${SLUG_MAX - 1}}$`);
const MENU_STYLES: readonly MenuStyle[] = ["ceir", "special"];
const MENU_CURRENCIES: readonly MenuCurrency[] = ["IDR", "USD"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Stored Order menu; anything missing or malformed falls back to the default. */
export function normalizeOrderMenu(value: unknown): UserMenu {
  const entry = isRecord(value) && isRecord(value.order) ? value.order : {};
  const label = typeof entry.label === "string" ? entry.label.trim() : "";
  return {
    label: label && label.length <= MENU_LABEL_MAX ? label : DEFAULT_ORDER_MENU.label,
    enabled: typeof entry.enabled === "boolean" ? entry.enabled : true,
  };
}

export function parseMenuLabel(value: unknown): string {
  const label = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!label) throw new BadRequestException("Nama menu wajib diisi.");
  if (label.length > MENU_LABEL_MAX) {
    throw new BadRequestException(`Nama menu maksimal ${MENU_LABEL_MAX} karakter.`);
  }
  return label;
}

function parseEnabled(value: unknown): boolean {
  if (typeof value !== "boolean") throw new BadRequestException("Status menu tidak valid.");
  return value;
}

export type MenuUpdate = { id: string; label: string; enabled: boolean };

/** Settings form body: the Order menu plus every service menu, in the new order. */
export function parseUserMenusInput(body: unknown): { order: UserMenu; menus: MenuUpdate[] } {
  if (!isRecord(body) || !isRecord(body.order) || !Array.isArray(body.menus)) {
    throw new BadRequestException("Data menu tidak valid.");
  }
  const menus = body.menus.map((entry) => {
    if (!isRecord(entry) || typeof entry.id !== "string" || !entry.id) {
      throw new BadRequestException("Data menu tidak valid.");
    }
    return { id: entry.id, label: parseMenuLabel(entry.label), enabled: parseEnabled(entry.enabled) };
  });
  if (new Set(menus.map((menu) => menu.id)).size !== menus.length) {
    throw new BadRequestException("Data menu tidak valid.");
  }
  return {
    order: { label: parseMenuLabel(body.order.label), enabled: parseEnabled(body.order.enabled) },
    menus,
  };
}

/** Lowercase ASCII slug from a label, e.g. "Cek Nomor HP" → "cek-nomor-hp". */
export function slugFromLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

export type NewMenuInput = { label: string; slug: string; style: MenuStyle; priceCurrency: MenuCurrency };

export function parseNewMenuInput(body: unknown): NewMenuInput {
  if (!isRecord(body)) throw new BadRequestException("Data menu tidak valid.");
  const label = parseMenuLabel(body.label);
  const slug = typeof body.slug === "string" && body.slug.trim() ? body.slug.trim() : slugFromLabel(label);
  if (!SLUG.test(slug) || RESERVED_SLUGS.has(slug)) {
    throw new BadRequestException("Alamat menu hanya boleh huruf kecil, angka, dan tanda hubung.");
  }
  const style = MENU_STYLES.find((value) => value === body.style);
  if (!style) throw new BadRequestException("Tipe menu harus Ceir atau Spesial.");
  const priceCurrency = MENU_CURRENCIES.find((value) => value === body.priceCurrency);
  if (!priceCurrency) throw new BadRequestException("Mata uang menu harus IDR atau USD.");
  return { label, slug, style, priceCurrency };
}

/** The menu a service is ordered from: its service menu, or the manual Order menu. */
export function menuOfService(
  service: { fulfillmentChannel: string; menu: Pick<MenuInfo, "label" | "enabled"> | null },
  order: UserMenu,
): UserMenu {
  if (service.fulfillmentChannel !== "supplier" || !service.menu) return order;
  return { label: service.menu.label, enabled: service.menu.enabled };
}
