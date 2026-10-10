import {
  BookOpenText,
  ClipboardText,
  ClockCounterClockwise,
  Code,
  DeviceMobile,
  FileText,
  Gauge,
  Gear,
  ListChecks,
  Megaphone,
  Package,
  PaperPlaneTilt,
  PlugsConnected,
  Shield,
  ShieldCheck,
  Sparkle,
  SquaresFour,
  User,
  Users,
  UsersThree,
  Wallet,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { MenuStyle } from "@/lib/types";
import type { MenuNavItem } from "@/lib/user-menus";

export interface NavItem {
  href: string;
  label: string;
  icon: Icon;
  /** Match nested routes under this href, not just the exact path. */
  nested?: boolean;
}

export const userNav: NavItem[] = [
  { href: "/app/dashboard", label: "Dashboard", icon: SquaresFour },
  { href: "/app/order", label: "Order", icon: Package, nested: true },
  { href: "/app/riwayat", label: "Riwayat Order", icon: ClockCounterClockwise },
  { href: "/app/topup", label: "Topup Saldo", icon: Wallet, nested: true },
  { href: "/app/api", label: "API Access", icon: Code },
  { href: "/app/docs", label: "API Docs", icon: BookOpenText },
  { href: "/app/telegram", label: "Telegram", icon: PaperPlaneTilt },
  { href: "/app/profil", label: "Profil", icon: User },
  { href: "/app/security", label: "Security", icon: Shield },
];

export const adminNav: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/admin/orders", label: "Orders", icon: ClipboardText, nested: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/groups", label: "Groups", icon: UsersThree },
  { href: "/admin/admins", label: "Admins", icon: ShieldCheck },
  { href: "/admin/services", label: "Services", icon: Package },
  { href: "/admin/suppliers", label: "Supplier API", icon: PlugsConnected },
  { href: "/admin/running-ads", label: "Ads Runner", icon: Megaphone },
  { href: "/admin/reports", label: "Reports", icon: FileText },
  { href: "/admin/activity", label: "Log Aktivitas", icon: ListChecks },
  { href: "/admin/security", label: "Security", icon: Shield },
  { href: "/admin/settings", label: "Settings", icon: Gear },
];

/**
 * Nav items carry icon components, which cannot cross the server/client
 * boundary as props. Client components resolve their list from this map by
 * variant instead of receiving it.
 */
export const NAV_BY_VARIANT = {
  user: userNav,
  admin: adminNav,
} as const;

export type NavVariant = keyof typeof NAV_BY_VARIANT;

/** Icon of an admin-defined service menu, by its style. */
export const MENU_STYLE_ICON: Record<MenuStyle, Icon> = {
  ceir: DeviceMobile,
  special: Sparkle,
};

/** Service menus are listed right after this entry. */
export const MENU_NAV_ANCHOR = "/app/order";

/** Static items plus the service menus (inserted after the Order entry). */
export function navItemsWithMenus(items: NavItem[], menus: MenuNavItem[] | undefined): NavItem[] {
  if (!menus?.length) return items;
  const extra: NavItem[] = menus.map((menu) => ({
    href: menu.href,
    label: menu.label,
    icon: MENU_STYLE_ICON[menu.style],
  }));
  const at = items.findIndex((item) => item.href === MENU_NAV_ANCHOR);
  if (at < 0) return [...items, ...extra];
  return [...items.slice(0, at + 1), ...extra, ...items.slice(at + 1)];
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.nested) return pathname.startsWith(item.href);
  return pathname === item.href;
}
