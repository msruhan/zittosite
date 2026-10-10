import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import {
  DEFAULT_USER_MENUS,
  type UserMenu,
  type UserMenus,
  type UserServiceMenu,
} from "@/lib/user-menus";

/** Menu settings for the signed-in user; defaults when the API cannot answer. */
export async function loadUserMenus(): Promise<UserMenus> {
  try {
    return await serverApi<UserMenus>("/menus");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    return DEFAULT_USER_MENUS;
  }
}

/** Order page guard: a disabled Order menu sends the user back to the dashboard. */
export async function requireOrderMenu(): Promise<UserMenu> {
  const menu = (await loadUserMenus()).order;
  if (!menu.enabled) redirect("/app/dashboard");
  return menu;
}

/** Service menu page guard: unknown or disabled menus send the user back to the dashboard. */
export async function requireServiceMenu(slug: string): Promise<UserServiceMenu> {
  const menu = (await loadUserMenus()).menus.find((entry) => entry.slug === slug);
  if (!menu?.enabled) redirect("/app/dashboard");
  return menu;
}
