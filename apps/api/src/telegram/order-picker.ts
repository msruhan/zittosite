import type { UserMenus } from "../orders/user-menus";

/** Bot /order first lists the manual "order" category, then one per service menu (by slug). */
export const ORDER_CATEGORY = "order";

export const SERVICES_PER_PAGE = 15;

const STYLE_EMOJI: Record<string, string> = {
  ceir: "🔎",
  special: "✨",
};

export function orderCategories(menus: UserMenus): string[] {
  return [ORDER_CATEGORY, ...menus.menus.map((menu) => menu.slug)];
}

export function parseOrderCategory(value: string, menus: UserMenus): string | null {
  return orderCategories(menus).find((key) => key === value) ?? null;
}

/** Manual services are "Order IMEI"; supplier services follow their menu. */
export function categoryOfService(service: { menu?: { slug: string } | null }): string {
  return service.menu?.slug ?? ORDER_CATEGORY;
}

/** Spesial-style menus first ask for a service group. */
export function isGroupedCategory(key: string, menus: UserMenus): boolean {
  return menus.menus.some((menu) => menu.slug === key && menu.style === "special");
}

/** Button label; the regular menu is shown as "Order IMEI" in the bot. */
export function categoryLabel(key: string, menus: UserMenus): string {
  if (key === ORDER_CATEGORY) return "📱 Order IMEI";
  const menu = menus.menus.find((entry) => entry.slug === key);
  return menu ? `${STYLE_EMOJI[menu.style] ?? "📦"} ${menu.label}` : key;
}

export function pageOf<T>(items: T[], page: number, size = SERVICES_PER_PAGE) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pages);
  return {
    items: items.slice((current - 1) * size, current * size),
    page: current,
    pages,
  };
}
