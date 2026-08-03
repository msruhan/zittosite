import {
  ClipboardList,
  FileText,
  Gauge,
  History,
  LayoutDashboard,
  Package,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match nested routes under this href, not just the exact path. */
  nested?: boolean;
}

export const userNav: NavItem[] = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/order", label: "Order", icon: Package, nested: true },
  { href: "/app/riwayat", label: "Riwayat Order", icon: History },
  { href: "/app/telegram", label: "Telegram", icon: Send },
  { href: "/app/profil", label: "Profil", icon: UserRound },
  { href: "/app/security", label: "Security", icon: Shield },
];

export const adminNav: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList, nested: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/admins", label: "Admins", icon: ShieldCheck },
  { href: "/admin/services", label: "Services", icon: Package },
  { href: "/admin/reports", label: "Reports", icon: FileText },
  { href: "/admin/security", label: "Security", icon: Shield },
  { href: "/admin/settings", label: "Settings", icon: Settings },
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
