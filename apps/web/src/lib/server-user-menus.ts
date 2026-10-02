import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import { DEFAULT_USER_MENUS, type UserMenuKey, type UserMenus } from "@/lib/user-menus";

/** Menu settings for the signed-in user; defaults when the API cannot answer. */
export async function loadUserMenus(): Promise<UserMenus> {
  try {
    return await serverApi<UserMenus>("/menus");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    return DEFAULT_USER_MENUS;
  }
}

/** Order page guard: a disabled menu sends the user back to the dashboard. */
export async function requireUserMenu(key: UserMenuKey): Promise<UserMenus[UserMenuKey]> {
  const menu = (await loadUserMenus())[key];
  if (!menu.enabled) redirect("/app/dashboard");
  return menu;
}
