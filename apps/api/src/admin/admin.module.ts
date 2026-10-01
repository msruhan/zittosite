import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminAuthService } from "./admin-auth.service";
import { AdminAuthController } from "./admin-auth.controller";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminTotpService } from "./admin-totp.service";
import { AdminOpsController } from "./admin-ops.controller";
import { AdminUsersService } from "./admin-users.service";
import { AdminServicesService } from "./admin-services.service";
import { AdminOrdersService } from "./admin-orders.service";
import { AdminAdminsService } from "./admin-admins.service";
import { AdminReportsService } from "./admin-reports.service";
import { SuperAdminGuard } from "./super-admin.guard";
import { AdminGroupsController } from "./admin-groups.controller";
import { AdminGroupsService } from "./admin-groups.service";
import { OrdersModule } from "../orders/orders.module";
import { AdminNotifyModule } from "../telegram/admin-notify.module";

@Module({
  imports: [PrismaModule, OrdersModule, AdminNotifyModule],
  controllers: [AdminAuthController, AdminOpsController, AdminGroupsController],
  providers: [
    AdminGroupsService,
    AdminAuthService,
    AdminAuthGuard,
    SuperAdminGuard,
    AdminTotpService,
    AdminUsersService,
    AdminServicesService,
    AdminOrdersService,
    AdminAdminsService,
    AdminReportsService,
  ],
  exports: [AdminAuthService, AdminAuthGuard, SuperAdminGuard, AdminTotpService],
})
export class AdminModule {}
