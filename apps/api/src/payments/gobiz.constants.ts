import { randomUUID } from "crypto";

/** Unofficial GoBiz merchant portal. Same calls CeirBot uses for its poller. */
export const GOBIZ_BASE_URL = "https://api.gobiz.co.id";
export const GOBIZ_ANALYTICS_URL =
  "https://api.gojekapi.com/merchant-analytics/v2/merchants/transactions";
export const GOBIZ_CLIENT_ID = "go-biz-web-new";
export const GOBIZ_PORTAL_ORIGIN = "https://portal.gofoodmerchant.co.id";
export const GOBIZ_DEFAULT_APP_VERSION = "platform-v3.122.0-72edb090";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

export function gobizAppVersion(): string {
  return process.env.GOBIZ_APP_VERSION?.trim() || GOBIZ_DEFAULT_APP_VERSION;
}

export function newGobizDeviceId(): string {
  return randomUUID();
}

export function gobizHeaders(deviceId: string, accessToken?: string): Record<string, string> {
  return {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "id",
    "Content-Type": "application/json",
    "Authentication-Type": "go-id",
    Authorization: accessToken ? `Bearer ${accessToken}` : "Bearer",
    "Gojek-Country-Code": "ID",
    "Gojek-Timezone": "Asia/Jakarta",
    Origin: GOBIZ_PORTAL_ORIGIN,
    Referer: `${GOBIZ_PORTAL_ORIGIN}/`,
    "User-Agent": USER_AGENT,
    "X-AppVersion": gobizAppVersion(),
    "X-AppId": "go-biz-web-dashboard",
    "X-PhoneMake": "Windows 10 64-bit",
    "X-PhoneModel": "Chrome 149.0.0.0 on Windows 10 64-bit",
    "X-Platform": "Web",
    "X-User-Locale": "en-US",
    "X-User-Type": "merchant",
    "X-DeviceOS": "Web",
    "X-UniqueId": deviceId,
  };
}
