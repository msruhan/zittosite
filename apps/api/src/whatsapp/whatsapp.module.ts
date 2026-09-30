import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { WahaClient } from "./waha.client";
import { WhatsappNotifyService } from "./whatsapp-notify.service";
import { WhatsappRetryService } from "./whatsapp-retry.service";

@Module({
  imports: [PrismaModule],
  providers: [WahaClient, WhatsappNotifyService, WhatsappRetryService],
  exports: [WhatsappNotifyService, WahaClient],
})
export class WhatsappModule {}
