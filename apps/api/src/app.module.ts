import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { AdminModule } from "./admin/admin.module";
import { TelegramModule } from "./telegram/telegram.module";
import { OrdersModule } from "./orders/orders.module";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AdminModule,
    TelegramModule,
    OrdersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
