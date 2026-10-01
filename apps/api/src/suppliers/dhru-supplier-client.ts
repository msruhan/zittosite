/**
 * Client for an upstream Dhru Fusion Classic panel (`/api/index.php`).
 * Dhru answers HTTP 200 with `{SUCCESS:[…]}` or `{ERROR:[{MESSAGE}]}`; an
 * ERROR is the supplier's decision, anything else is a transport problem.
 */

export type SupplierConfig = { baseUrl: string; username: string; apiKey: string };

export type RemoteService = {
  id: string;
  name: string;
  group: string;
  credit: number;
  time: string;
  info: string;
};

export type DhruReply<T> = { ok: true; data: T } | { ok: false; message: string };

/** Network failure, non-2xx status, or a body that is not a Dhru envelope. */
export class SupplierRequestError extends Error {}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

const DEFAULT_TIMEOUT_MS = 30_000;

export function supplierEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return /\.php$/i.test(trimmed) ? trimmed : `${trimmed}/api/index.php`;
}

export function checkSupplierUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return "URL supplier tidak valid.";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return "URL supplier harus http(s).";
  }
  if (url.username || url.password) return "URL supplier tidak boleh berisi kredensial.";
  return null;
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function xmlParameters(params: Record<string, string>): string {
  const body = Object.entries(params)
    .map(([k, v]) => `<${k.toUpperCase()}>${xmlEscape(v)}</${k.toUpperCase()}>`)
    .join("");
  return body ? `<PARAMETERS>${body}</PARAMETERS>` : "";
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

/** Dhru carries SN/ECID in their own fields; IMEI already travels as `IMEI`. */
export function supplierInputFields(
  inputType: "imei" | "sn" | "ecid",
  value: string,
): Record<string, string> {
  if (inputType === "sn") return { SN: value };
  if (inputType === "ecid") return { ECID: value };
  return {};
}

export function parseServiceList(list: unknown): RemoteService[] {
  if (!list || typeof list !== "object") return [];
  const out: RemoteService[] = [];
  for (const [groupKey, rawGroup] of Object.entries(list as Record<string, unknown>)) {
    if (!rawGroup || typeof rawGroup !== "object") continue;
    const group = rawGroup as { GROUPNAME?: unknown; SERVICES?: unknown };
    const services = group.SERVICES;
    if (!services || typeof services !== "object") continue;
    for (const [serviceKey, rawService] of Object.entries(services as Record<string, unknown>)) {
      if (!rawService || typeof rawService !== "object") continue;
      const svc = rawService as Record<string, unknown>;
      out.push({
        id: text(svc.SERVICEID) || serviceKey,
        name: text(svc.SERVICENAME) || `Service ${serviceKey}`,
        group: text(group.GROUPNAME) || groupKey,
        credit: Number.parseFloat(text(svc.CREDIT)) || 0,
        time: text(svc.TIME),
        info: text(svc.INFO),
      });
    }
  }
  return out;
}

export class DhruSupplierClient {
  constructor(
    private readonly config: SupplierConfig,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {}

  private async call(
    action: string,
    params: Record<string, string> = {},
  ): Promise<DhruReply<Record<string, unknown>>> {
    const form = new URLSearchParams({
      username: this.config.username,
      apiaccesskey: this.config.apiKey,
      action,
      requestformat: "JSON",
      parameters: xmlParameters(params),
    });
    let res: Response;
    try {
      res = await this.fetchImpl(supplierEndpoint(this.config.baseUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": "Zittosite-Supplier/1.0 (DhruFusion Classic API)",
        },
        body: form.toString(),
        redirect: "error",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new SupplierRequestError(
        `Supplier tidak dapat dihubungi: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!res.ok) throw new SupplierRequestError(`Supplier membalas HTTP ${res.status}.`);
    const body = await res.text();
    let json: { SUCCESS?: unknown; ERROR?: unknown };
    try {
      json = JSON.parse(body) as typeof json;
    } catch {
      throw new SupplierRequestError(`Respons supplier bukan JSON: ${body.slice(0, 120)}`);
    }
    if (Array.isArray(json.ERROR)) {
      const first = json.ERROR[0] as { MESSAGE?: unknown } | undefined;
      return { ok: false, message: text(first?.MESSAGE) || "Supplier menolak permintaan." };
    }
    if (Array.isArray(json.SUCCESS) && json.SUCCESS[0] && typeof json.SUCCESS[0] === "object") {
      return { ok: true, data: json.SUCCESS[0] as Record<string, unknown> };
    }
    throw new SupplierRequestError("Respons supplier tidak dikenali.");
  }

  async accountInfo(): Promise<DhruReply<{ credit: string; currency: string; mail: string }>> {
    const reply = await this.call("accountinfo");
    if (!reply.ok) return reply;
    const info = (reply.data.AccoutInfo ?? reply.data.AccountInfo ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      data: { credit: text(info.credit), currency: text(info.currency), mail: text(info.mail) },
    };
  }

  async serviceList(): Promise<DhruReply<RemoteService[]>> {
    const reply = await this.call("imeiservicelist");
    if (!reply.ok) return reply;
    return { ok: true, data: parseServiceList(reply.data.LIST) };
  }

  async placeOrder(
    serviceId: string,
    imei: string,
    extra: Record<string, string> = {},
  ): Promise<DhruReply<{ referenceId: string }>> {
    const fields = { IMEI: imei, ...extra };
    const reply = await this.call("placeimeiorder", {
      ID: serviceId,
      IMEI: imei,
      CUSTOMFIELD: Buffer.from(JSON.stringify(fields), "utf8").toString("base64"),
    });
    if (!reply.ok) return reply;
    const referenceId = text(reply.data.REFERENCEID);
    if (!referenceId) throw new SupplierRequestError("Supplier tidak mengirim REFERENCEID.");
    return { ok: true, data: { referenceId } };
  }

  async orderStatus(
    referenceId: string,
  ): Promise<DhruReply<{ status: number; code: string; comments: string }>> {
    const reply = await this.call("getimeiorder", { ID: referenceId });
    if (!reply.ok) return reply;
    return {
      ok: true,
      data: {
        status: Number(reply.data.STATUS ?? 0),
        code: text(reply.data.CODE),
        comments: text(reply.data.COMMENTS),
      },
    };
  }
}
