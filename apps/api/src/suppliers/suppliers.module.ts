import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminModule } from "../admin/admin.module";
import { OrdersModule } from "../orders/orders.module";
import { SuppliersController } from "./suppliers.controller";
import { SuppliersService } from "./suppliers.service";
import { SupplierWorkerService } from "./supplier-worker.service";

@Module({
  imports: [PrismaModule, AdminModule, OrdersModule],
  controllers: [SuppliersController],
  providers: [SuppliersService, SupplierWorkerService],
})
export class SuppliersModule {}
