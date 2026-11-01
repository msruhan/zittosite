import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { PrismaModule } from "../prisma/prisma.module";
import { OrdersModule } from "../orders/orders.module";
import { AdminNotifyModule } from "../telegram/admin-notify.module";
import { GobizClient } from "./gobiz.client";
import { GobizPollerWorker } from "./gobiz-poller.worker";
import { GobizSessionService } from "./gobiz-session.service";
import { PaymentAdminController } from "./payment-admin.controller";
import { PaymentModeModule } from "./payment-mode.module";
import { SayabayarWebhookController } from "./sayabayar.webhook.controller";

@Module({
  imports: [PrismaModule, AdminModule, AdminNotifyModule, OrdersModule, PaymentModeModule],
  controllers: [SayabayarWebhookController, PaymentAdminController],
  providers: [GobizClient, GobizSessionService, GobizPollerWorker],
})
export class PaymentsModule {}
