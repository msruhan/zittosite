import {
  Controller,
  Headers,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { TelegramBotService } from "./telegram.bot";

@Controller("webhooks")
export class TelegramWebhookController {
  constructor(private readonly telegram: TelegramBotService) {}

  @Post("telegram")
  async handle(
    @Req() req: any,
    @Headers("x-telegram-bot-api-secret-token") secret?: string,
  ) {
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
    if (expected) {
      if (secret !== expected) {
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
