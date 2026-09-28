import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { sayabayarConfig } from "../config/env";

const REQUEST_TIMEOUT_MS = 15_000;

/** A non-success SayaBayar response; `code` is e.g. UNAUTHORIZED, VALIDATION_ERROR, RATE_LIMIT_EXCEEDED. */
export class SayabayarApiError extends ServiceUnavailableException {
  constructor(readonly code: string) {
    super("Payment gateway sedang tidak tersedia. Coba lagi beberapa saat.");
  }
}

export type SayabayarInvoice = {
  id: string;
  invoiceNumber: string | null;
  amount: number;
  amountDue: number;
  paymentUrl: string | null;
  qrisString: string | null;
  expiredAt: Date | null;
  raw: Record<string, unknown>;
};

export type SayabayarInvoiceStatus = {
  /** pending | paid | expired (per SayaBayar docs); user_confirmed after /confirm. */
  status: string;
  amount: number | null;
  paidAt: Date | null;
  channel: string | null;
  raw: Record<string, unknown>;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asInt(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) ? n : null;
}

function asDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function earliest(...dates: (Date | null)[]): Date | null {
  const valid = dates.filter((d): d is Date => d !== null);
  if (!valid.length) return null;
  return new Date(Math.min(...valid.map((d) => d.getTime())));
}

@Injectable()
export class SayabayarClient {
  private readonly logger = new Logger(SayabayarClient.name);

  enabled(): boolean {
    return sayabayarConfig() !== null;
  }

  /** `expiredMinutes` must be within 60–10080 per the SayaBayar API. */
  async createInvoice(input: {
    amount: number;
    description: string;
    customerName: string;
    expiredMinutes: number;
    redirectUrl: string;
  }): Promise<SayabayarInvoice> {
    const config = this.requireConfig();
    const data = await this.request("POST", "/invoices", {
      customer_name: input.customerName,
      amount: input.amount,
      description: input.description,
      payment_method: config.paymentMethod,
      ...(config.channelPreference
        ? { channel_preference: config.channelPreference }
        : {}),
      expired_minutes: input.expiredMinutes,
      redirect_url: input.redirectUrl,
    });

    const id = asString(data.id);
    if (!id) {
      this.logger.error("SayaBayar invoice response has no id");
      throw this.unavailable();
    }
    const channel =
      data.payment_channel && typeof data.payment_channel === "object"
        ? (data.payment_channel as Record<string, unknown>)
        : {};
    const amount = asInt(data.amount) ?? input.amount;
    const qrisString = asString(channel.qris_string);
    // The dynamic QRIS can expire before the invoice (e.g. 30 vs 60 minutes);
    // once it does the shown QR is unpayable, so the order expires with it.
    const expiredAt = earliest(
      asDate(data.expired_at),
      qrisString ? asDate(channel.expired_at) : null,
    );

    return {
      id,
      invoiceNumber: asString(data.invoice_number),
      amount,
      amountDue:
        asInt(data.amount_to_pay) ??
        asInt(channel.amount_to_pay) ??
        asInt(data.amount_unique) ??
        amount,
      paymentUrl: asString(data.payment_url),
      qrisString,
      expiredAt,
      raw: data,
    };
  }

  async getInvoice(gatewayInvoiceId: string): Promise<SayabayarInvoiceStatus> {
    const data = await this.request(
      "GET",
      `/invoices/${encodeURIComponent(gatewayInvoiceId)}`,
    );
    const channel = data.payment_channel;
    return {
      status: asString(data.status) ?? "unknown",
      amount: asInt(data.amount),
      paidAt: asDate(data.paid_at),
      channel:
        asString(channel) ??
        (channel && typeof channel === "object"
          ? asString((channel as Record<string, unknown>).channel_type)
          : null),
      raw: data,
    };
  }

  /** `confirm` only works for QRIS and bank transfer, not Virtual Accounts. */
  supportsConfirm(): boolean {
    const method = sayabayarConfig()?.paymentMethod ?? "";
    return method === "qris" || method === "bca_transfer";
  }

  /**
   * Asks SayaBayar to check for the payment now (detected within 1–2 seconds).
   * Best-effort: failures (incl. VA_NO_CONFIRM) are logged and ignored.
   */
  async confirmInvoice(gatewayInvoiceId: string): Promise<void> {
    try {
      await this.request(
        "POST",
        `/invoices/${encodeURIComponent(gatewayInvoiceId)}/confirm`,
      );
    } catch {
      // Already logged by request(); payment is still detected automatically.
    }
  }

  private requireConfig() {
    const config = sayabayarConfig();
    if (!config) throw this.unavailable();
    return config;
  }

  private unavailable() {
    return new ServiceUnavailableException(
      "Payment gateway sedang tidak tersedia. Coba lagi beberapa saat.",
    );
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const config = this.requireConfig();
    let res: Response;
    try {
      res = await fetch(`${config.baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": config.apiKey,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err: any) {
      this.logger.error(`SayaBayar ${method} ${path} failed: ${err?.message ?? err}`);
      throw this.unavailable();
    }

    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok || json?.success === false) {
      const code = asString(json?.error?.code) ?? `HTTP_${res.status}`;
      const detail = json?.error
        ? `${code}: ${json.error.message ?? ""} ${json.error.details ? JSON.stringify(json.error.details) : ""}`
        : text.slice(0, 500);
      this.logger.error(
        `SayaBayar ${method} ${path} -> ${res.status} ${detail.trim()} (request_id ${json?.meta?.request_id ?? "-"})`,
      );
      throw new SayabayarApiError(code);
    }
    const data = json?.data;
    return data && typeof data === "object" ? data : {};
  }
}
