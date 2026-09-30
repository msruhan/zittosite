import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { OrdersModule } from "../orders/orders.module";
import { WhatsappModule } from "../whatsapp/whatsapp.module";
import { RoamercheckService } from "./roamercheck.service";
import { WahaWebhookController } from "./waha.webhook.controller";

@Module({
  imports: [PrismaModule, OrdersModule, WhatsappModule],
  controllers: [WahaWebhookController],
  providers: [RoamercheckService],
})
export class WhatsappInboundModule {}
