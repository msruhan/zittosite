import { createHmac, randomBytes } from "crypto";
import { lookup } from "dns/promises";
import { isIP } from "net";

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

/** `sha256=<hex>` over `<timestamp>.<body>`, sent as X-Signature. */
export function signWebhook(secret: string, timestamp: number, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

/** Delay before retry n (1-based); null once retries are exhausted. */
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000];

export function nextRetryDelay(attempts: number): number | null {
  return RETRY_DELAYS_MS[attempts - 1] ?? null;
}

export const MAX_DELIVERY_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

/** Local testing only: http and private targets, never in production. */
export function insecureWebhooksAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.WEBHOOK_ALLOW_INSECURE === "1" && env.NODE_ENV !== "production";
}

function ipv4Private(ip: string): boolean {
  const [a = 0, b = 0] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

/** True for loopback, private, link-local, CGNAT, multicast and reserved ranges. */
export function isNonPublicIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return ipv4Private(ip);
  if (version !== 6) return true;
  const lower = ip.toLowerCase();
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Private(mapped[1]!);
  return (
    lower === "::" ||
    lower === "::1" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe8") ||
    lower.startsWith("fe9") ||
    lower.startsWith("fea") ||
    lower.startsWith("feb") ||
    lower.startsWith("ff")
  );
}

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

/** Syntax rules only: HTTPS, no credentials, no IP-literal private hosts. */
export function checkWebhookUrlSyntax(raw: string, allowInsecure = false): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "URL tidak valid." };
  }
  const httpAllowed = allowInsecure && url.protocol === "http:";
  if (url.protocol !== "https:" && !httpAllowed) {
    return { ok: false, reason: "URL webhook wajib https://." };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "URL webhook tidak boleh berisi username/password." };
  }
  if (allowInsecure) return { ok: true, url };
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return { ok: false, reason: "URL webhook harus alamat publik." };
  }
  if (isIP(host) && isNonPublicIp(host)) {
    return { ok: false, reason: "URL webhook harus alamat publik." };
  }
  return { ok: true, url };
}

/** Syntax rules plus DNS: every resolved address must be public. */
export async function checkWebhookUrl(
  raw: string,
  resolve: (host: string) => Promise<string[]> = defaultResolve,
  allowInsecure = insecureWebhooksAllowed(),
): Promise<UrlCheck> {
  const syntax = checkWebhookUrlSyntax(raw, allowInsecure);
  if (!syntax.ok || allowInsecure) return syntax;
  const host = syntax.url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return syntax;
  let addresses: string[];
  try {
    addresses = await resolve(host);
  } catch {
    return { ok: false, reason: "Domain webhook tidak dapat di-resolve." };
  }
  if (!addresses.length || addresses.some(isNonPublicIp)) {
    return { ok: false, reason: "URL webhook harus alamat publik." };
  }
  return syntax;
}

async function defaultResolve(host: string): Promise<string[]> {
  const records = await lookup(host, { all: true, verbatim: true });
  return records.map((record) => record.address);
}
