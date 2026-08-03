import { Module, forwardRef } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AdminNotifyModule } from "../telegram/admin-notify.module";
import { OrdersController } from "./orders.controller";
import { ServicesController } from "./services.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [PrismaModule, AuthModule, forwardRef(() => AdminNotifyModule)],
  controllers: [OrdersController, ServicesController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
