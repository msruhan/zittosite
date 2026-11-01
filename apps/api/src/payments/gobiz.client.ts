import { Injectable } from "@nestjs/common";
import {
  GOBIZ_ANALYTICS_URL,
  GOBIZ_BASE_URL,
  GOBIZ_CLIENT_ID,
  gobizHeaders,
} from "./gobiz.constants";

export type GobizTokens = { accessToken: string; refreshToken: string };
export type GobizMerchant = { id: string; name: string | null };

export type GobizTransaction = {
  id: string;
  /** Rupiah. The feed reports minor units. */
  amount: number;
  status: string;
  paymentType: string;
  occurredAt: Date;
  raw: Record<string, unknown>;
};

export class GobizAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GobizAuthError";
  }
}

export class GobizApiError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
  ) {
    super(message);
    this.name = "GobizApiError";
  }
}

const REQUEST_TIMEOUT_MS = 15_000;

@Injectable()
export class GobizClient {
  fetchFn: typeof fetch = (...args) => fetch(...args);

  async requestOtp(phone: string, deviceId: string): Promise<{ otpToken: string; otpLength: number | null }> {
    const body = await this.post(
      "/goid/login/request",
      { client_id: GOBIZ_CLIENT_ID, phone_number: normalizeGobizPhone(phone), country_code: "62" },
      deviceId,
    );
    const data = (body.data ?? body) as Record<string, unknown>;
    const otpToken = typeof data.otp_token === "string" ? data.otp_token : null;
    if (!otpToken) throw new GobizApiError("GoBiz tidak mengembalikan token OTP.", 502);
    return { otpToken, otpLength: typeof data.otp_length === "number" ? data.otp_length : null };
  }

  verifyOtp(otp: string, otpToken: string, deviceId: string): Promise<GobizTokens> {
    return this.tokenRequest({ grant_type: "otp", data: { otp: otp.trim(), otp_token: otpToken } }, deviceId);
  }

  refresh(refreshToken: string, deviceId: string): Promise<GobizTokens> {
    return this.tokenRequest({ grant_type: "refresh_token", data: { refresh_token: refreshToken } }, deviceId);
  }

  async findMerchant(accessToken: string, deviceId: string): Promise<GobizMerchant> {
    const body = await this.post(
      "/v1/merchants/search",
      { from: 0, to: 1, _source: ["id", "merchant_name"] },
      deviceId,
      accessToken,
    );
    const first = extractMerchantList(body)[0];
    const id = first?.id ?? first?.merchant_id;
    if (typeof id !== "string" || !id) {
      throw new GobizApiError("Akun GoBiz ini tidak punya merchant.", 404);
    }
    return { id, name: typeof first?.merchant_name === "string" ? first.merchant_name : null };
  }

  async listTransactions(
    accessToken: string,
    merchantId: string,
    deviceId: string,
    since: Date,
    until = new Date(),
  ): Promise<GobizTransaction[]> {
    const url = new URL(GOBIZ_ANALYTICS_URL);
    url.searchParams.set("from", "0");
    url.searchParams.set("size", "50");
    url.searchParams.set("statuses", "SETTLEMENT,CAPTURE");
    url.searchParams.set("payment_types", "QRIS,GOPAY");
    url.searchParams.set("start_time", since.toISOString());
    url.searchParams.set("end_time", until.toISOString());
    url.searchParams.set("merchant_ids", merchantId);

    const res = await this.request(url.toString(), {
      method: "GET",
      headers: gobizHeaders(deviceId, accessToken),
    });
    const body = await readJson(res);
    if (res.status === 401) throw new GobizAuthError(errorMessage(body) ?? "Token GoBiz kedaluwarsa.");
    if (!res.ok) {
      throw new GobizApiError(`Transaksi GoBiz gagal: ${errorMessage(body) ?? res.status}`, res.status);
    }
    const list = Array.isArray(body.transactions) ? body.transactions : [];
    return list.map(parseTransaction).filter((tx): tx is GobizTransaction => tx !== null);
  }

  private async tokenRequest(payload: Record<string, unknown>, deviceId: string): Promise<GobizTokens> {
    const body = await this.post("/goid/token", { client_id: GOBIZ_CLIENT_ID, ...payload }, deviceId);
    const accessToken = typeof body.access_token === "string" ? body.access_token : null;
    const refreshToken = typeof body.refresh_token === "string" ? body.refresh_token : null;
    if (!accessToken || !refreshToken) throw new GobizAuthError("Respons token GoBiz tidak lengkap.");
    return { accessToken, refreshToken };
  }

  private async post(
    path: string,
    payload: Record<string, unknown>,
    deviceId: string,
    accessToken?: string,
  ): Promise<Record<string, unknown>> {
    const res = await this.request(`${GOBIZ_BASE_URL}${path}`, {
      method: "POST",
      headers: gobizHeaders(deviceId, accessToken),
      body: JSON.stringify(payload),
    });
    const body = await readJson(res);
    const message = errorMessage(body);
    if (res.status === 401) throw new GobizAuthError(message ?? "GoBiz menolak sesi.");
    if (path === "/goid/token" && (res.status === 400 || res.status === 403)) {
      throw new GobizAuthError(message ?? "GoBiz menolak kredensial.");
    }
    if (!res.ok || (Array.isArray(body.errors) && body.errors.length > 0)) {
      throw new GobizApiError(`GoBiz ${path} gagal: ${message ?? res.status}`, res.status);
    }
    return body;
  }

  private request(url: string, init: RequestInit): Promise<Response> {
    return this.fetchFn(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  }
}

export function normalizeGobizPhone(input: string): string {
  let phone = input.trim().replace(/[\s\-.()]/g, "").replace(/^\+/, "");
  if (phone.startsWith("62") && phone.length > 7) phone = phone.slice(2);
  phone = phone.replace(/^0/, "");
  if (!/^\d{7,15}$/.test(phone)) throw new Error("Nomor HP tidak valid.");
  return phone;
}

export function parseTransaction(input: unknown): GobizTransaction | null {
  if (!input || typeof input !== "object") return null;
  const tx = input as Record<string, unknown>;
  const idRaw = tx.transaction_id ?? tx.id ?? tx.order_id;
  const gross = Number(tx.gross_amount);
  const occurredAt = new Date(String(tx.transaction_time ?? ""));
  if (idRaw === undefined || idRaw === null || idRaw === "") return null;
  if (!Number.isFinite(gross) || Number.isNaN(occurredAt.getTime())) return null;
  return {
    id: String(idRaw),
    amount: Math.round(gross / 100),
    status: String(tx.status ?? "").toUpperCase(),
    paymentType: String(tx.payment_type ?? "").toUpperCase(),
    occurredAt,
    raw: tx,
  };
}

function extractMerchantList(body: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  if (Array.isArray(body.merchants)) return body.merchants as Record<string, unknown>[];
  if (Array.isArray(body.hits)) {
    return (body.hits as unknown[]).map((hit) => {
      const row = hit as { _source?: Record<string, unknown> };
      return row?._source ?? (hit as Record<string, unknown>);
    });
  }
  const hits = body.hits as { hits?: unknown[] } | undefined;
  if (Array.isArray(hits?.hits)) {
    return hits.hits.map((hit) => {
      const row = hit as { _source?: Record<string, unknown> };
      return row?._source ?? (hit as Record<string, unknown>);
    });
  }
  if (Array.isArray(body.data)) return body.data as Record<string, unknown>[];
  return [];
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const parsed = await res.json();
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function errorMessage(body: Record<string, unknown>): string | null {
  const first = Array.isArray(body.errors) ? (body.errors[0] as { message?: unknown } | undefined) : null;
  const message = first?.message ?? body.message;
  return typeof message === "string" && message ? message : null;
}
