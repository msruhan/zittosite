import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
  UnauthorizedException,
  type RawBodyRequest,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { wahaInboundConfig } from "../config/env";
import { RoamercheckService, type WahaMessagePayload } from "./roamercheck.service";

function hmacValid(rawBody: Buffer, provided: string, secret: string): boolean {
  const expected = createHmac("sha512", secret).update(rawBody).digest();
  const actual = Buffer.from(provided.trim(), "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** WAHA event webhook (WHATSAPP_HOOK_URL), signed with WHATSAPP_HOOK_HMAC_KEY. */
@Controller("webhooks/waha")
@SkipThrottle()
export class WahaWebhookController {
  private readonly logger = new Logger(WahaWebhookController.name);

  constructor(private readonly roamercheck: RoamercheckService) {}

  @Post()
  @HttpCode(200)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-webhook-hmac") hmac?: string,
  ) {
    const config = wahaInboundConfig();
    if (!config) return { received: false };
    if (!req.rawBody || !hmac || !hmacValid(req.rawBody, hmac, config.secret)) {
      throw new UnauthorizedException("Invalid signature");
    }

    const body = req.body as { event?: unknown; payload?: WahaMessagePayload };
    if (body?.event !== "message" || !body.payload || typeof body.payload !== "object") {
      return { received: true };
    }
    try {
      const outcome = await this.roamercheck.handle(body.payload);
      if (!outcome.startsWith("ignored: other")) {
        this.logger.log(`WAHA message ${String(body.payload.id ?? "?")}: ${outcome}`);
      }
    } catch (err) {
      this.logger.warn(
        `WAHA message handling failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return { received: true };
  }
}
