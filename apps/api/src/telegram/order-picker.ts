import type { UserMenus } from "../orders/user-menus";

/** Bot /order first lists these categories; each opens its own service list. */
export const ORDER_CATEGORIES = ["order", "ceir", "special"] as const;
export type OrderCategory = (typeof ORDER_CATEGORIES)[number];

export const SERVICES_PER_PAGE = 15;

const EMOJI: Record<OrderCategory, string> = {
  order: "📱",
  ceir: "🔎",
  special: "✨",
};

export function parseOrderCategory(value: string): OrderCategory | null {
  return ORDER_CATEGORIES.find((key) => key === value) ?? null;
}

/** Manual services are "Order IMEI"; supplier services follow their menu. */
export function categoryOfService(service: { menu: string | null }): OrderCategory {
  if (service.menu === "special") return "special";
  if (service.menu === "ceir") return "ceir";
  return "order";
}

/** Button label; the regular menu is shown as "Order IMEI" in the bot. */
export function categoryLabel(key: OrderCategory, menus: UserMenus): string {
  const label = key === "order" ? "Order IMEI" : menus[key].label;
  return `${EMOJI[key]} ${label}`;
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
