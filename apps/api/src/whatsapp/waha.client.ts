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
