import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { OrdersModule } from "../orders/orders.module";
import { ApiKeysService } from "./api-keys.service";
import { ApiPortalController } from "./api-portal.controller";
import { DhruController } from "./dhru.controller";
import { DhruService } from "./dhru.service";
import { WebhookService } from "./webhook.service";

@Module({
  imports: [PrismaModule, AuthModule, OrdersModule],
  controllers: [DhruController, ApiPortalController],
  providers: [ApiKeysService, DhruService, WebhookService],
})
export class ApiAccessModule {}
