import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { WhatsappModule } from "../whatsapp/whatsapp.module";
import { AdminNotifyService } from "./admin-notify.service";
import { AdminTelegramLinkService } from "./admin-telegram-link.service";

@Module({
  imports: [PrismaModule, WhatsappModule],
  providers: [AdminNotifyService, AdminTelegramLinkService],
  exports: [AdminNotifyService, AdminTelegramLinkService],
})
export class AdminNotifyModule {}
