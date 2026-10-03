import type { OrderStatus, ResultStatus } from "@prisma/client";
import { customerText } from "../orders/customer-text";

export const DHRU_API_VERSION = "8.2";

export type DhruResponse = Record<string, unknown>;

export function dhruSuccess(...items: Record<string, unknown>[]): DhruResponse {
  return { SUCCESS: items, apiversion: DHRU_API_VERSION };
}

export function dhruError(message: string, fullDescription = message): DhruResponse {
  return {
    ERROR: [{ MESSAGE: message, FULL_DESCRIPTION: fullDescription }],
    apiversion: DHRU_API_VERSION,
  };
}

const ACTION_ALIASES: Record<string, DhruAction> = {
  accountinfo: "accountinfo",
  imeiservicelist: "imeiservicelist",
  servicelist: "imeiservicelist",
  getservices: "imeiservicelist",
  placeimeiorder: "placeimeiorder",
  placeorder: "placeimeiorder",
  placeimeiorderbulk: "placeimeiorderbulk",
  placeorderbulk: "placeimeiorderbulk",
  orderstatus: "orderstatus",
  getimeiorder: "orderstatus",
  getserverorder: "orderstatus",
  orderstatusbulk: "orderstatusbulk",
  getimeiorderbulk: "orderstatusbulk",
  getserverorderbulk: "orderstatusbulk",
};

export type DhruAction =
  | "accountinfo"
  | "imeiservicelist"
  | "placeimeiorder"
  | "placeimeiorderbulk"
  | "orderstatus"
  | "orderstatusbulk";

export function resolveDhruAction(raw: unknown): DhruAction | null {
  const key = String(raw ?? "").trim().toLowerCase();
  return ACTION_ALIASES[key] ?? null;
}

type Form = Record<string, unknown>;

function firstField(form: Form, names: string[]): string {
  for (const name of names) {
    const value = form[name];
    const text = Array.isArray(value) ? value[0] : value;
    if (typeof text === "string" && text.trim()) return text.trim();
    if (typeof text === "number") return String(text);
  }
  return "";
}

/**
 * Username and key from the form. Accepts the aliases used by other Dhru
 * servers, and a full `<username>.<key>` in either field.
 */
export function readCredentials(form: Form): { username: string; key: string } {
  let username = firstField(form, ["username", "api_username", "user"]);
  let key = firstField(form, ["apiaccesskey", "key", "api_key", "apikey", "accesskey"]);
  // Keys never contain a dot; usernames may, so only split the key field or a lone username.
  const dotted = key.includes(".") ? key : !key ? username : "";
  const dot = dotted.lastIndexOf(".");
  if (dot > 0 && dot < dotted.length - 1) {
    username = dotted.slice(0, dot);
    key = dotted.slice(dot + 1);
  }
  return { username: username.toLowerCase(), key };
}

function upperKeys(source: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(source)) {
    if (v === null || v === undefined || typeof v === "object") continue;
    out[k.toUpperCase()] = String(v).trim();
  }
  return out;
}

function parseXmlTags(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<([A-Za-z0-9_.-]+)>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    out[match[1]!.toUpperCase()] = match[2]!.trim();
  }
  return out;
}

/** `parameters` as JSON, XML (`<PARAMETERS><ID>…</ID></PARAMETERS>`), or empty. */
export function parseParameterValue(raw: string): unknown {
  const text = raw.trim();
  if (!text) return null;
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  }
  if (text.startsWith("<")) {
    const tags = parseXmlTags(text);
    return tags.PARAMETERS ? parseXmlTags(tags.PARAMETERS) : tags;
  }
  return null;
}

/**
 * Single-order parameters: flat form fields (ID, SERVICEID, IMEI, ORDERID)
 * overlaid by the `parameters` block, with keys upper-cased.
 */
export function readParameters(form: Form): Record<string, string> {
  const flat = upperKeys(
    Object.fromEntries(
      Object.entries(form).filter(
        ([k]) => !["username", "apiaccesskey", "action", "parameters", "requestformat"].includes(k.toLowerCase()),
      ),
    ),
  );
  const parsed = parseParameterValue(firstField(form, ["parameters"]));
  const block =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? upperKeys(parsed as Record<string, unknown>)
      : {};
  const merged = { ...flat, ...block };
  return { ...decodeCustomField(merged.CUSTOMFIELD), ...merged };
}

/** Dhru clients may send order fields as base64 JSON in CUSTOMFIELD. */
export function decodeCustomField(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? upperKeys(parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** Bulk items from `parameters`: a JSON array, or an object of objects keyed by line. */
export function readBulkItems(form: Form): Record<string, string>[] {
  const parsed = parseParameterValue(firstField(form, ["parameters"]));
  if (!parsed || typeof parsed !== "object") return [];
  const list = Array.isArray(parsed) ? parsed : Object.values(parsed as Record<string, unknown>);
  return list
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map(upperKeys);
}

/** Order ids for status lookups, from `orderid`, ID/REFERENCEID, or a JSON/CSV list. */
export function readOrderIds(form: Form): string[] {
  const parsed = parseParameterValue(firstField(form, ["parameters"]));
  if (Array.isArray(parsed)) {
    return parsed
      .map((item) =>
        item && typeof item === "object"
          ? upperKeys(item as Record<string, unknown>).ID ??
            upperKeys(item as Record<string, unknown>).REFERENCEID ??
            ""
          : String(item ?? ""),
      )
      .map((id) => id.trim())
      .filter(Boolean);
  }
  const params = readParameters(form);
  const raw = params.ORDERID || params.REFERENCEID || params.ID || "";
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export type DhruStatusCode = 0 | 1 | 3 | 4;

/** A done order whose result failed was refunded, so it reports as failed (3). */
export function dhruStatusCode(
  status: OrderStatus,
  resultStatus?: ResultStatus | null,
): DhruStatusCode {
  switch (status) {
    case "in_process":
      return 1;
    case "rejected":
    case "cancel":
      return 3;
    case "done":
      return resultStatus === "failed" ? 3 : 4;
    default:
      return 0;
  }
}

export const DHRU_STATUS_MESSAGE: Record<DhruStatusCode, string> = {
  0: "Order pending",
  1: "Order in process",
  3: "Order rejected",
  4: "Order completed",
};

export type DescribableOrder = {
  orderId: string;
  imei: string;
  status: OrderStatus;
  statusReason: string | null;
  result: { resultStatus: ResultStatus; resultNote: string } | null;
};

/**
 * Dhru view of an order. CODE is what Dhru panels show the end customer: the
 * result for finished orders, the reason for rejected/cancelled ones.
 */
export function describeOrder(order: DescribableOrder) {
  const status = dhruStatusCode(order.status, order.result?.resultStatus);
  const comments =
    order.status === "rejected" || order.status === "cancel"
      ? customerText(order.statusReason) ?? ""
      : order.result?.resultStatus === "failed"
        ? order.result.resultNote
        : "";
  const code = order.status === "done" ? order.result?.resultNote ?? "" : comments;
  return {
    status,
    code,
    comments,
    message: DHRU_STATUS_MESSAGE[status],
  };
}

export type WebhookEvent = "order.completed" | "order.rejected" | "order.cancelled";

/** Webhook event for a finished order; null while it is still open. */
export function webhookEventFor(order: Pick<DescribableOrder, "status" | "result">): WebhookEvent | null {
  if (order.status === "cancel") return "order.cancelled";
  if (order.status === "rejected") return "order.rejected";
  if (order.status === "done") {
    return order.result?.resultStatus === "failed" ? "order.rejected" : "order.completed";
  }
  return null;
}
