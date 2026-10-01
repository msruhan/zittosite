import {
  ClipboardText,
  ClockCounterClockwise,
  FileText,
  Gauge,
  Gear,
  ListChecks,
  Megaphone,
  Package,
  PaperPlaneTilt,
  Shield,
  ShieldCheck,
  SquaresFour,
  User,
  Users,
  UsersThree,
  Wallet,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

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

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.nested) return pathname.startsWith(item.href);
  return pathname === item.href;
}
