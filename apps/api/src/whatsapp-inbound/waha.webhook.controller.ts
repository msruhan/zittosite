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
import { wahaWebhookSecret } from "../config/env";
import { AdminReactionService, type WahaReactionPayload } from "./admin-reaction.service";
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

  constructor(
    private readonly roamercheck: RoamercheckService,
    private readonly reactions: AdminReactionService,
  ) {}

  @Post()
  @HttpCode(200)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-webhook-hmac") hmac?: string,
  ) {
    const secret = wahaWebhookSecret();
    if (!secret) return { received: false };
    if (!req.rawBody || !hmac || !hmacValid(req.rawBody, hmac, secret)) {
      throw new UnauthorizedException("Invalid signature");
    }

    const body = req.body as { event?: unknown; payload?: unknown };
    if (!body?.payload || typeof body.payload !== "object") return { received: true };
    try {
      if (body.event === "message") {
        const payload = body.payload as WahaMessagePayload;
        const command = await this.reactions.handleCommand(payload);
        if (command !== null) {
          if (!command.startsWith("ignored: other") && command !== "off") {
            this.logger.log(`WAHA command: ${command}`);
          }
          return { received: true };
        }
        const outcome = await this.roamercheck.handle(payload);
        if (!outcome.startsWith("ignored: other") && outcome !== "off") {
          this.logger.log(`WAHA message ${String(payload.id ?? "?")}: ${outcome}`);
        }
      } else if (body.event === "message.reaction") {
        const outcome = await this.reactions.handle(body.payload as WahaReactionPayload);
        if (!outcome.startsWith("ignored: other") && outcome !== "off") {
          this.logger.log(`WAHA reaction: ${outcome}`);
        }
      }
    } catch (err) {
      this.logger.warn(
        `WAHA ${String(body.event)} handling failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return { received: true };
  }
}
