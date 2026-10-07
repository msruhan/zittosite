import { Injectable, Logger } from "@nestjs/common";
import { wahaConnection } from "../config/env";

const REQUEST_TIMEOUT_MS = 15_000;

export class WahaApiError extends Error {
  constructor(
    readonly code: string,
    readonly detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

/** Minimal WAHA (WhatsApp HTTP API) client; send-only. */
@Injectable()
export class WahaClient {
  private readonly logger = new Logger(WahaClient.name);

  enabled(): boolean {
    return wahaConnection() !== null;
  }

  /** `replyTo` is the full WAHA id of a message to quote. */
  async sendText(
    chatId: string,
    text: string,
    replyTo?: string,
  ): Promise<{ messageId: string | null }> {
    const config = wahaConnection();
    if (!config) throw new WahaApiError("not_configured");
    if (config.mock) {
      this.logger.log(`[WAHA_MOCK] sendText to ${chatId}:\n${text}`);
      return { messageId: `true_${chatId}_MOCK${Date.now()}` };
    }

    let res: Response;
    try {
      res = await fetch(`${config.baseUrl}/api/sendText`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": config.apiKey },
        body: JSON.stringify({
          session: config.session,
          chatId,
          text,
          ...(replyTo ? { reply_to: replyTo } : {}),
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw new WahaApiError(
        "network_error",
        err instanceof Error ? err.message : String(err),
      );
    }

    const body = await res.text().catch(() => "");
    if (!res.ok) {
      throw new WahaApiError(`http_${res.status}`, body.slice(0, 240));
    }
    return { messageId: parseMessageId(body) };
  }

  /** Groups the session's number is in, sorted by name. */
  async listGroups(): Promise<WhatsappGroup[]> {
    const config = wahaConnection();
    if (!config) throw new WahaApiError("not_configured");
    if (config.mock) return [{ id: "mock-admin@g.us", name: "Mock Admin" }];
    const session = encodeURIComponent(config.session);
    const [groups, me] = await Promise.all([
      this.getJson(`/api/${session}/groups`),
      this.getJson(`/api/sessions/${session}/me`).catch(() => null),
    ]);
    return parseGroups(groups, selfIds(me));
  }

  private async getJson(path: string): Promise<unknown> {
    const config = wahaConnection();
    if (!config) throw new WahaApiError("not_configured");
    let res: Response;
    try {
      res = await fetch(`${config.baseUrl}${path}`, {
        headers: { "X-Api-Key": config.apiKey },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw new WahaApiError("network_error", err instanceof Error ? err.message : String(err));
    }
    if (!res.ok) {
      throw new WahaApiError(`http_${res.status}`, (await res.text().catch(() => "")).slice(0, 240));
    }
    return res.json().catch(() => null);
  }

  /** WhatsApp LID (`…@lid`) of a phone number; group senders are often reported by LID. */
  async lidForPhone(phone: string): Promise<string | null> {
    const config = wahaConnection();
    if (!config || config.mock) return null;
    try {
      const res = await fetch(
        `${config.baseUrl}/api/${encodeURIComponent(config.session)}/lids/pn/${encodeURIComponent(phone)}`,
        {
          headers: { "X-Api-Key": config.apiKey },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
      if (!res.ok) return null;
      const json = (await res.json()) as { lid?: unknown };
      return typeof json.lid === "string" && json.lid ? json.lid : null;
    } catch (err) {
      this.logger.warn(
        `WAHA LID lookup failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}

export type WhatsappGroup = { id: string; name: string };

/** User part of a JID: "6281…:1@s.whatsapp.net" → "6281…". */
function jidUser(jid: unknown): string | null {
  if (typeof jid !== "string" || !jid.includes("@")) return null;
  return jid.split("@")[0]!.split(":")[0] || null;
}

/** Phone and LID users of the session's own number, from `GET /api/sessions/{s}/me`. */
export function selfIds(me: unknown): Set<string> {
  const ids = new Set<string>();
  if (me && typeof me === "object") {
    const m = me as Record<string, unknown>;
    for (const value of [m.id, m.lid, m.jid]) {
      const user = jidUser(value);
      if (user) ids.add(user);
    }
  }
  return ids;
}

function participantUsers(group: Record<string, unknown>): string[] | null {
  const list = group.Participants ?? group.participants;
  if (!Array.isArray(list)) return null;
  return list.flatMap((p) => {
    if (!p || typeof p !== "object") return [];
    const r = p as Record<string, unknown>;
    const id = r.id as { _serialized?: unknown } | string | undefined;
    return [r.JID, r.PhoneNumber, r.LID, typeof id === "string" ? id : id?._serialized]
      .map(jidUser)
      .filter((u): u is string => u !== null);
  });
}

/**
 * WAHA engines return groups as an array or an id-keyed map, with WEBJS or GOWS field names.
 * GOWS keeps groups the number has left; with `self` known those are dropped by membership.
 */
export function parseGroups(body: unknown, self: Set<string> = new Set()): WhatsappGroup[] {
  const list = Array.isArray(body) ? body : body && typeof body === "object" ? Object.values(body) : [];
  const groups: WhatsappGroup[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const g = raw as Record<string, unknown>;
    const idField = g.id ?? g.JID;
    const id =
      typeof idField === "string"
        ? idField
        : (idField as { _serialized?: unknown } | undefined)?._serialized;
    if (typeof id !== "string" || !id.endsWith("@g.us")) continue;
    const members = participantUsers(g);
    if (self.size && members?.length && !members.some((user) => self.has(user))) continue;
    const name = [g.subject, g.name, g.Name].find((v) => typeof v === "string" && v.trim());
    groups.push({ id, name: typeof name === "string" ? name.trim() : id });
  }
  return groups.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Bare WhatsApp message id. WAHA serialises ids as `true_<chat>_<id>[_<participant>]`,
 * while reaction events may carry either form.
 */
export function messageKey(id: string): string {
  const parts = id.split("_");
  return (parts[0] === "true" || parts[0] === "false") && parts.length >= 3 ? parts[2]! : id;
}

function parseMessageId(body: string): string | null {
  try {
    const json = JSON.parse(body) as { id?: unknown };
    if (typeof json.id === "string") return json.id;
    if (json.id && typeof json.id === "object") {
      const serialized = (json.id as { _serialized?: unknown })._serialized;
      if (typeof serialized === "string") return serialized;
    }
  } catch {
    // WAHA engines differ in response shape; the message id is informational only.
  }
  return null;
}
