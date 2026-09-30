import { Injectable, Logger } from "@nestjs/common";
import { whatsappConfig } from "../config/env";

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
    return whatsappConfig() !== null;
  }

  async sendText(chatId: string, text: string): Promise<{ messageId: string | null }> {
    const config = whatsappConfig();
    if (!config) throw new WahaApiError("not_configured");
    if (config.mock) {
      this.logger.log(`[WAHA_MOCK] sendText to ${chatId}:\n${text}`);
      return { messageId: `mock-${Date.now()}` };
    }

    let res: Response;
    try {
      res = await fetch(`${config.baseUrl}/api/sendText`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": config.apiKey },
        body: JSON.stringify({ session: config.session, chatId, text }),
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
