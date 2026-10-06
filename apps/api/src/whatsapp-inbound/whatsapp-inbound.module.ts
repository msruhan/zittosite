import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { OrdersModule } from "../orders/orders.module";
import { WhatsappModule } from "../whatsapp/whatsapp.module";
import { AdminReactionService } from "./admin-reaction.service";
import { RoamercheckService } from "./roamercheck.service";
import { WahaWebhookController } from "./waha.webhook.controller";

@Module({
  imports: [PrismaModule, OrdersModule, WhatsappModule],
  controllers: [WahaWebhookController],
  providers: [RoamercheckService, AdminReactionService],
})
export class WhatsappInboundModule {}
