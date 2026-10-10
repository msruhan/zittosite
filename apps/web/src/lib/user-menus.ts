import type { MenuStyle, ServiceMenu } from "@/lib/types";

/** The manual Order menu; its name and switch are set by Super Admin. */
export type UserMenu = { label: string; enabled: boolean };

/** A supplier service menu as listed in settings and the sidebar. */
export type UserServiceMenu = ServiceMenu & { enabled: boolean; sortOrder: number };

/** The manual Order menu followed by the service menus, in sidebar order. */
export type UserMenus = { order: UserMenu; menus: UserServiceMenu[] };

export const MENU_LABEL_MAX = 30;
export const MAX_MENUS = 20;

export const ORDER_MENU_HREF = "/app/order";

export const DEFAULT_USER_MENUS: UserMenus = {
  order: { label: "Order", enabled: true },
  menus: [],
};

export function menuHistoryHref(slug: string): string {
  return `/app/m/${slug}`;
}

export function menuOrderHref(slug: string): string {
  return `/app/m/${slug}/order`;
}

/** Sidebar entry of a service menu; serializable so it can cross into the client shell. */
export type MenuNavItem = { href: string; label: string; style: MenuStyle };

export function menuNavItems(menus: UserMenus): MenuNavItem[] {
  return menus.menus
    .filter((menu) => menu.enabled)
    .map((menu) => ({ href: menuOrderHref(menu.slug), label: menu.label, style: menu.style }));
}
