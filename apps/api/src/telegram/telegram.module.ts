import { Module, forwardRef } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AdminModule } from "../admin/admin.module";
import { AdminNotifyModule } from "./admin-notify.module";
import { OrdersModule } from "../orders/orders.module";
import { TelegramBotService } from "./telegram.bot";
import { TelegramWebhookController } from "./telegram.webhook.controller";
import {
  AdminTelegramOauthController,
  UserTelegramOauthController,
} from "./telegram-oauth.controller";
import { TelegramOauthService } from "./telegram-oauth.service";
import { TelegramLinkTokenService } from "./telegram-link-token.service";
import { AdminTelegramInviteService } from "./admin-telegram-invite.service";
import { AdminTelegramInviteController } from "./admin-telegram-invite.controller";
import { OrderRecapService } from "./order-recap.service";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AdminModule,
    AdminNotifyModule,
    forwardRef(() => OrdersModule),
  ],
  providers: [
    TelegramBotService,
    TelegramOauthService,
    TelegramLinkTokenService,
    AdminTelegramInviteService,
    OrderRecapService,
  ],
  controllers: [
    TelegramWebhookController,
    UserTelegramOauthController,
    AdminTelegramOauthController,
    AdminTelegramInviteController,
  ],
  exports: [TelegramBotService, AdminNotifyModule],
})
export class TelegramModule {}
