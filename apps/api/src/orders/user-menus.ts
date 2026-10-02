import { BadRequestException } from "@nestjs/common";
import type { ServiceMenu } from "@prisma/client";

/** SystemSetting key holding the user ordering menus' names and switches. */
export const USER_MENUS_KEY = "user_menus";

/** The three ordering menus in the user sidebar. */
export const USER_MENU_KEYS = ["order", "ceir", "special"] as const;
export type UserMenuKey = (typeof USER_MENU_KEYS)[number];

export type UserMenu = { label: string; enabled: boolean };
export type UserMenus = Record<UserMenuKey, UserMenu>;

export const MENU_LABEL_MAX = 30;

export const DEFAULT_USER_MENUS: UserMenus = {
  order: { label: "Order", enabled: true },
  ceir: { label: "Order Ceir", enabled: true },
  special: { label: "Layanan Spesial", enabled: true },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Stored value → menus; anything missing or malformed falls back to the default. */
export function normalizeUserMenus(value: unknown): UserMenus {
  const stored = isRecord(value) ? value : {};
  const menus = {} as UserMenus;
  for (const key of USER_MENU_KEYS) {
    const entry = isRecord(stored[key]) ? stored[key] : {};
    const label = typeof entry.label === "string" ? entry.label.trim() : "";
    menus[key] = {
      label: label && label.length <= MENU_LABEL_MAX ? label : DEFAULT_USER_MENUS[key].label,
      enabled: typeof entry.enabled === "boolean" ? entry.enabled : true,
    };
  }
  return menus;
}

/** Admin request body → menus; every menu needs a name. */
export function parseUserMenusInput(body: unknown): UserMenus {
  if (!isRecord(body)) throw new BadRequestException("Data menu tidak valid.");
  const menus = {} as UserMenus;
  for (const key of USER_MENU_KEYS) {
    const entry = body[key];
    if (!isRecord(entry)) throw new BadRequestException("Data menu tidak valid.");
    const label = typeof entry.label === "string" ? entry.label.trim().replace(/\s+/g, " ") : "";
    if (!label) throw new BadRequestException("Nama menu wajib diisi.");
    if (label.length > MENU_LABEL_MAX) {
      throw new BadRequestException(`Nama menu maksimal ${MENU_LABEL_MAX} karakter.`);
    }
    if (typeof entry.enabled !== "boolean") {
      throw new BadRequestException("Status menu tidak valid.");
    }
    menus[key] = { label, enabled: entry.enabled };
  }
  return menus;
}

/** Which user menu a service is ordered from. */
export function menuOfService(service: {
  fulfillmentChannel: string;
  menu: ServiceMenu;
}): UserMenuKey {
  if (service.fulfillmentChannel !== "supplier") return "order";
  return service.menu === "special" ? "special" : "ceir";
}
