import { Module } from "@nestjs/common";
import { OrdersModule } from "../orders/orders.module";
import { SayabayarWebhookController } from "./sayabayar.webhook.controller";

@Module({
  imports: [OrdersModule],
  controllers: [SayabayarWebhookController],
})
export class PaymentsModule {}
