/**
 * Client for the GContact+ phone lookup API (`GET ?token=…&nomor=…`).
 * Answers `{ok:true, primary_name, tag[], …, remaining_quota}` or
 * `{ok:false, error, message}`; one request is one used quota.
 */

import { SupplierRequestError, type RemoteService } from "./dhru-supplier-client";

export const GCONTACT_DEFAULT_URL = "https://gcontact.id/api";

/** The only remote "service"; services import it like a Dhru SERVICEID. */
export const GCONTACT_SERVICE: RemoteService = {
  id: "lookup",
  name: "GContact+ Cek Nomor HP",
  group: "GContact+",
  credit: 0,
  time: "Instan",
  info: "Nama, tag kontak, e-wallet, dan WhatsApp dari nomor HP.",
  inputType: "phone",
  currency: null,
};

export type GContactLookup = {
  /** Readable result lines ("Label: value"); stored as the order's result note. */
  lines: string[];
  remainingQuota: number | null;
};

export type GContactReply =
  | { ok: true; data: GContactLookup }
  /** `account` errors are ours (token, quota, rate limit) and are retried, not shown to customers. */
  | { ok: false; message: string; account: boolean };

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** A lookup can take ~20 s at GContact. */
const DEFAULT_TIMEOUT_MS = 60_000;
const ACCOUNT_ERROR = /token|quota|kuota|limit|unauthori[sz]ed|forbidden|maintenance|expired/i;

const LABELS: Record<string, string> = {
  nomor: "Nomor",
  primary_name: "Nama",
  summary: "Ringkasan",
  tagcount: "Jumlah Tag",
  tag: "Tag",
  ewallet: "E-Wallet",
  whatsapp: "WhatsApp",
  searchengine: "Mesin Pencari",
  getcontact_photo: "Foto",
};
const EWALLET_NAMES: Record<string, string> = {
  gopay: "GoPay",
  ovo: "OVO",
  dana: "DANA",
  shopeepay: "ShopeePay",
  linkaja: "LinkAja",
};
const ORDER = [
  "nomor",
  "primary_name",
  "tagcount",
  "tag",
  "ewallet",
  "whatsapp",
  "searchengine",
  "getcontact_photo",
  "summary",
];
const SKIP = new Set(["ok", "remaining_quota", "error", "message", "token", "time_taken"]);
/** Tags arrive sorted by how many contacts saved the number that way; the long tail is noise. */
const MAX_TAGS = 25;
const MAX_LIST_ITEMS = 40;

function humanKey(key: string): string {
  return LABELS[key] ?? key.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** [{tag, count}] → "• Indobypass (99)", most saved first. */
function tagLines(value: unknown[]): string[] {
  const tags = value
    .map((item) => {
      const row = record(item);
      const name = row ? scalar(row.tag ?? row.name) : scalar(item);
      const count = row ? Number(row.count) : NaN;
      return name ? { name, count: Number.isFinite(count) ? count : null } : null;
    })
    .filter((tag): tag is { name: string; count: number | null } => Boolean(tag));
  if (!tags.length) return [];
  const shown = tags.slice(0, MAX_TAGS);
  return [
    tags.length > MAX_TAGS ? `Tag (${MAX_TAGS} teratas dari ${tags.length})` : `Tag (${tags.length})`,
    ...shown.map((tag) => `• ${tag.name}${tag.count !== null ? ` (${tag.count})` : ""}`),
  ];
}

/** Registered wallets with their account name; the rest summarized on one line. */
function ewalletLines(value: unknown[]): string[] {
  const registered: string[] = [];
  const missing: string[] = [];
  for (const item of value) {
    const row = record(item);
    const provider = row ? scalar(row.provider) : null;
    if (!row || !provider) continue;
    const label = EWALLET_NAMES[provider.toLowerCase()] ?? provider;
    if (row.registered === false) missing.push(label);
    else registered.push(`${label}: ${scalar(row.name) ?? "terdaftar"}`);
  }
  if (!registered.length && !missing.length) return [];
  return [
    ...(registered.length ? registered : ["E-Wallet: tidak ada yang terdaftar"]),
    ...(registered.length && missing.length ? [`E-Wallet lain: tidak terdaftar (${missing.join(", ")})`] : []),
  ];
}

function whatsappLines(value: Record<string, unknown>): string[] {
  if (value.registered === false) return ["WhatsApp: tidak terdaftar"];
  const profile = record(value.business_profile);
  const parts = [
    "terdaftar",
    value.is_business === true ? `akun bisnis${scalar(profile?.category) ? ` (${scalar(profile?.category)})` : ""}` : null,
  ].filter(Boolean);
  const lines = [`WhatsApp: ${parts.join(", ")}`];
  const name = scalar(value.name);
  if (name) lines.push(`WhatsApp Nama: ${name}`);
  for (const key of ["description", "address", "website", "email"]) {
    const text = scalar(profile?.[key]);
    if (text) lines.push(`WhatsApp ${humanKey(key)}: ${text}`);
  }
  return lines;
}

function scalar(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (typeof value === "object") return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text || null;
}

/** One object as "key: value · key: value"; nested values are skipped. */
function inlineObject(value: Record<string, unknown>): string {
  return Object.entries(value)
    .map(([key, v]) => {
      const text = scalar(v);
      return text ? `${humanKey(key)}: ${text}` : null;
    })
    .filter(Boolean)
    .join(" · ");
}

/** GContact JSON → readable lines, known fields first. */
export function gcontactResultLines(body: Record<string, unknown>): string[] {
  const keys = [
    ...ORDER.filter((key) => key in body),
    ...Object.keys(body).filter((key) => !ORDER.includes(key)),
  ].filter((key) => !SKIP.has(key));
  const lines: string[] = [];
  for (const key of keys) {
    const label = humanKey(key);
    const value = body[key];
    if (key === "tag" && Array.isArray(value)) {
      lines.push(...tagLines(value));
    } else if (key === "ewallet" && Array.isArray(value)) {
      lines.push(...ewalletLines(value));
    } else if (key === "whatsapp" && record(value)) {
      lines.push(...whatsappLines(record(value)!));
    } else if (Array.isArray(value)) {
      const items = value
        .map((item) =>
          item && typeof item === "object" && !Array.isArray(item)
            ? inlineObject(item as Record<string, unknown>)
            : scalar(item),
        )
        .filter((item): item is string => Boolean(item));
      if (!items.length) continue;
      lines.push(`${label} (${items.length})`);
      lines.push(...items.slice(0, MAX_LIST_ITEMS).map((item) => `• ${item}`));
      if (items.length > MAX_LIST_ITEMS) lines.push(`• … ${items.length - MAX_LIST_ITEMS} lainnya`);
    } else if (value && typeof value === "object") {
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        const text = scalar(subValue);
        if (text) lines.push(`${label} ${humanKey(subKey)}: ${text}`);
      }
    } else {
      const text = scalar(value);
      if (text) lines.push(`${label}: ${text}`);
    }
  }
  return lines.length ? lines : ["Data tidak ditemukan."];
}

export class GContactClient {
  constructor(
    private readonly config: { baseUrl: string; token: string },
    private readonly fetchImpl: FetchLike = fetch,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {}

  private async call(nomor: string | null): Promise<{ status: number; body: Record<string, unknown> }> {
    const url = new URL(this.config.baseUrl.trim() || GCONTACT_DEFAULT_URL);
    url.searchParams.set("token", this.config.token);
    if (nomor) url.searchParams.set("nomor", nomor);
    let res: Response;
    try {
      res = await this.fetchImpl(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json", "User-Agent": "Zittosite-Supplier/1.0 (GContact)" },
        redirect: "error",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new SupplierRequestError(
        `GContact tidak dapat dihubungi: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (res.status >= 500) throw new SupplierRequestError(`GContact membalas HTTP ${res.status}.`);
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new SupplierRequestError(`Respons GContact bukan JSON: ${text.slice(0, 120)}`);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new SupplierRequestError("Respons GContact tidak dikenali.");
    }
    return { status: res.status, body: body as Record<string, unknown> };
  }

  private static failure(status: number, body: Record<string, unknown>): GContactReply {
    const error = scalar(body.error) ?? "";
    const message = scalar(body.message) ?? (error || `HTTP ${status}`);
    const account = [401, 402, 403, 429].includes(status) || ACCOUNT_ERROR.test(`${error} ${message}`);
    return { ok: false, message, account };
  }

  async lookup(nomor: string): Promise<GContactReply> {
    const { status, body } = await this.call(nomor);
    if (body.ok !== true) return GContactClient.failure(status, body);
    const quota = Number(body.remaining_quota);
    return {
      ok: true,
      data: {
        lines: gcontactResultLines(body),
        remainingQuota: Number.isFinite(quota) ? quota : null,
      },
    };
  }

  /**
   * Checks the token without spending quota: a request without `nomor` that
   * only complains about the missing number means the token was accepted.
   */
  async checkToken(): Promise<{ ok: true } | { ok: false; message: string }> {
    const { status, body } = await this.call(null);
    const error = scalar(body.error) ?? "";
    if (body.ok === true || /missing\s*parameter/i.test(error)) return { ok: true };
    const failed = GContactClient.failure(status, body);
    return { ok: false, message: failed.ok ? "" : failed.message };
  }
}
