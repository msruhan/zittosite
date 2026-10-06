import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { WahaClient } from "./waha.client";
import { WhatsappAdminService } from "./whatsapp-admin.service";
import { WhatsappNotifyService } from "./whatsapp-notify.service";
import { WhatsappRetryService } from "./whatsapp-retry.service";

@Module({
  imports: [PrismaModule],
  providers: [WahaClient, WhatsappNotifyService, WhatsappAdminService, WhatsappRetryService],
  exports: [WhatsappNotifyService, WhatsappAdminService, WahaClient],
})
export class WhatsappModule {}
