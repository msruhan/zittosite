import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AdminAuthGuard } from "./admin-auth.guard";
import { SuperAdminGuard } from "./super-admin.guard";
import { AdminUsersService } from "./admin-users.service";
import { AdminServicesService } from "./admin-services.service";
import { AdminOrdersService } from "./admin-orders.service";
import { AdminAdminsService } from "./admin-admins.service";
import { AdminReportsService } from "./admin-reports.service";

@Controller("admin")
@UseGuards(AdminAuthGuard)
export class AdminOpsController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly services: AdminServicesService,
    private readonly orders: AdminOrdersService,
    private readonly admins: AdminAdminsService,
    private readonly reports: AdminReportsService,
  ) {}

  @Get("dashboard/stats")
  dashboard(@Req() req: { admin: { sub: string } }) {
    return this.orders.dashboardStats(req.admin.sub);
  }

  @Get("reports/summary")
  reportsSummary() {
    return this.reports.summary();
  }

  @Get("users")
  @UseGuards(SuperAdminGuard)
  listUsers(@Query("q") q?: string) {
    return this.users.list(q);
  }

  @Post("users")
  @UseGuards(SuperAdminGuard)
  createUser(@Body() body: Record<string, unknown>) {
    return this.users.create({
      username: body.username as string | undefined,
      fullName: body.fullName as string | undefined,
      password: body.password as string | undefined,
      telegramHandle: body.telegramHandle as string | null | undefined,
      customPrice: body.customPrice as number | null | undefined,
      botAccess: body.botAccess as boolean | undefined,
    });
  }

  @Patch("users/:id")
  @UseGuards(SuperAdminGuard)
  updateUser(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.users.update(id, {
      fullName: body.fullName as string | undefined,
      telegramHandle: body.telegramHandle as string | null | undefined,
      customPrice: body.customPrice as number | null | undefined,
      status: body.status as "active" | "suspended" | undefined,
      botAccess: body.botAccess as boolean | undefined,
      password: body.password as string | undefined,
    });
  }

  @Delete("users/:id")
  @UseGuards(SuperAdminGuard)
  deleteUser(@Param("id") id: string) {
    return this.users.remove(id);
  }

  @Get("services")
  @UseGuards(SuperAdminGuard)
  listServices() {
    return this.services.list();
  }

  @Post("services")
  @UseGuards(SuperAdminGuard)
  createService(@Body() body: Record<string, unknown>) {
    return this.services.create({
      code: body.code as string | undefined,
      name: body.name as string | undefined,
      description: body.description as string | undefined,
      price: body.price as number | undefined,
      estimate: body.estimate as string | undefined,
      active: body.active as boolean | undefined,
    });
  }

  @Patch("services/:id")
  @UseGuards(SuperAdminGuard)
  updateService(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.services.update(id, {
      name: body.name as string | undefined,
      description: body.description as string | undefined,
      price: body.price as number | undefined,
      estimate: body.estimate as string | undefined,
      active: body.active as boolean | undefined,
    });
  }

  @Get("orders")
  listOrders(
    @Req() req: { admin: { sub: string } },
    @Query("q") q?: string,
    @Query("status") status?: string,
  ) {
    return this.orders.list(req.admin.sub, q, status);
  }

  @Get("orders/:orderId")
  getOrder(
    @Req() req: { admin: { sub: string } },
    @Param("orderId") orderId: string,
  ) {
    return this.orders.get(req.admin.sub, orderId);
  }

  @Patch("orders/:orderId/status")
  @UseGuards(SuperAdminGuard)
  overrideStatus(
    @Req() req: { admin: { sub: string } },
    @Param("orderId") orderId: string,
    @Body() body: { status?: string; note?: string },
  ) {
    return this.orders.overrideStatus(
      req.admin.sub,
      orderId,
      String(body.status ?? ""),
      body.note,
    );
  }

  @Get("admins")
  @UseGuards(SuperAdminGuard)
  listAdmins(@Query("q") q?: string) {
    return this.admins.list(q);
  }

  @Post("admins")
  @UseGuards(SuperAdminGuard)
  createAdmin(@Body() body: Record<string, unknown>) {
    return this.admins.create({
      username: body.username as string | undefined,
      fullName: body.fullName as string | undefined,
      password: body.password as string | undefined,
      role: body.role as "admin" | "super_admin" | undefined,
    });
  }

  @Patch("admins/:id")
  @UseGuards(SuperAdminGuard)
  updateAdmin(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.admins.update(req.admin.sub, id, {
      fullName: body.fullName as string | undefined,
      role: body.role as "admin" | "super_admin" | undefined,
      status: body.status as "active" | "blocked" | undefined,
      password: body.password as string | undefined,
    });
  }

  @Delete("admins/:id")
  @UseGuards(SuperAdminGuard)
  deleteAdmin(@Req() req: any, @Param("id") id: string) {
    return this.admins.remove(req.admin.sub, id);
  }
}
