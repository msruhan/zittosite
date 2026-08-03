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
  dashboard() {
    return this.orders.dashboardStats();
  }

  @Get("reports/summary")
  reportsSummary() {
    return this.reports.summary();
  }

  @Get("users")
  listUsers(@Query("q") q?: string) {
    return this.users.list(q);
  }

  @Post("users")
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
  deleteUser(@Param("id") id: string) {
    return this.users.remove(id);
  }

  @Get("services")
  listServices() {
    return this.services.list();
  }

  @Post("services")
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
  listOrders(@Query("q") q?: string, @Query("status") status?: string) {
    return this.orders.list(q, status);
  }

  @Get("orders/:orderId")
  getOrder(@Param("orderId") orderId: string) {
    return this.orders.get(orderId);
  }

  @Patch("orders/:orderId/status")
  overrideStatus(
    @Req() req: any,
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
