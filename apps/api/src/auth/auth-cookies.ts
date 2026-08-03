import type { Response } from "express";

export const USER_AUTH_COOKIE = "zittosite_user_token";
export const ADMIN_AUTH_COOKIE = "zittosite_admin_token";

const MAX_AGE_MS = 12 * 60 * 60 * 1000;

function cookieOptions() {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE_MS,
  };
}

function clearOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
  };
}

export function setUserAuthCookie(res: Response, token: string) {
  res.cookie(USER_AUTH_COOKIE, token, cookieOptions());
}

export function setAdminAuthCookie(res: Response, token: string) {
  res.cookie(ADMIN_AUTH_COOKIE, token, cookieOptions());
}

export function clearUserAuthCookie(res: Response) {
  res.clearCookie(USER_AUTH_COOKIE, clearOptions());
}

export function clearAdminAuthCookie(res: Response) {
  res.clearCookie(ADMIN_AUTH_COOKIE, clearOptions());
}

export function extractAuthToken(
  req: { headers?: Record<string, unknown>; cookies?: Record<string, string> },
  cookieName: string,
): string | null {
  const header = req.headers?.["authorization"];
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return header.slice(7);
  }
  const fromCookie = req.cookies?.[cookieName];
  return typeof fromCookie === "string" && fromCookie.length > 0
    ? fromCookie
    : null;
}
