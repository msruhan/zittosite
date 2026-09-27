import {
  Controller,
  Headers,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { createHash, timingSafeEqual } from "crypto";
import { TelegramBotService } from "./telegram.bot";

function secretsMatch(actual: string | undefined, expected: string): boolean {
  const a = createHash("sha256").update(String(actual ?? "")).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

@Controller("webhooks")
@SkipThrottle()
export class TelegramWebhookController {
  constructor(private readonly telegram: TelegramBotService) {}

  @Post("telegram")
  async handle(
    @Req() req: any,
    @Headers("x-telegram-bot-api-secret-token") secret?: string,
  ) {
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
    if (expected) {
      if (!secretsMatch(secret, expected)) {
        throw new UnauthorizedException("Invalid telegram webhook secret");
      }
    } else if (process.env.NODE_ENV === "production") {
      throw new UnauthorizedException("TELEGRAM_WEBHOOK_SECRET required");
    }
    const bot = this.telegram.getBot();
    if (!bot || !this.telegram.isReady()) {
      throw new ServiceUnavailableException("Telegram bot is not ready");
    }
    await bot.handleUpdate(req.body);
    return { ok: true };
  }
}
