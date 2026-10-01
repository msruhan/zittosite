import { Module, forwardRef } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AdminNotifyModule } from "../telegram/admin-notify.module";
import { SayabayarModule } from "../payments/sayabayar.module";
import { WhatsappModule } from "../whatsapp/whatsapp.module";
import { OrdersController } from "./orders.controller";
import { ServicesController } from "./services.controller";
import { OrdersService } from "./orders.service";
import { OrderExpiryService } from "./order-expiry.service";
import { TopupController } from "./topup.controller";
import { TopupService } from "./topup.service";
import { SupplierDispatch } from "./supplier-dispatch";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    SayabayarModule,
    forwardRef(() => AdminNotifyModule),
    WhatsappModule,
  ],
  controllers: [OrdersController, ServicesController, TopupController],
  providers: [OrdersService, OrderExpiryService, TopupService, SupplierDispatch],
  exports: [OrdersService, TopupService, SupplierDispatch],
})
export class OrdersModule {}
