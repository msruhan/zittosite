import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminNotifyService } from "./admin-notify.service";
import { AdminTelegramLinkService } from "./admin-telegram-link.service";

@Module({
  imports: [PrismaModule],
  providers: [AdminNotifyService, AdminTelegramLinkService],
  exports: [AdminNotifyService, AdminTelegramLinkService],
})
export class AdminNotifyModule {}
