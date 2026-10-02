/** The three user ordering menus; names and switches are set by Super Admin. */
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

/** Sidebar entry of each menu. */
export const USER_MENU_HREF: Record<UserMenuKey, string> = {
  order: "/app/order",
  ceir: "/app/ceir/order",
  special: "/app/spesial/order",
};

export function userMenuNavLabels(menus: UserMenus): Record<string, string> {
  return Object.fromEntries(USER_MENU_KEYS.map((key) => [USER_MENU_HREF[key], menus[key].label]));
}

export function disabledUserMenuHrefs(menus: UserMenus): string[] {
  return USER_MENU_KEYS.filter((key) => !menus[key].enabled).map((key) => USER_MENU_HREF[key]);
}
