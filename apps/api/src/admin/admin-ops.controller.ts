import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AdminAuthGuard } from "./admin-auth.guard";
import { SuperAdminGuard } from "./super-admin.guard";
import { AdminUsersService } from "./admin-users.service";
import { AdminServicesService } from "./admin-services.service";
import { AdminOrdersService } from "./admin-orders.service";
import { OrdersService } from "../orders/orders.service";
import { AdminAdminsService } from "./admin-admins.service";
import { AdminReportsService } from "./admin-reports.service";
import { AdminTotpService } from "./admin-totp.service";
import { AuditLogService } from "../security/audit-log.service";
import { SENSITIVE_THROTTLE } from "../security/throttle";
import {
  optBoolean,
  optEnum,
  optIdList,
  optNonNegativeInt,
  optNullableNonNegativeInt,
  optNullableString,
  optServicePrices,
  optString,
} from "../security/input";

type AdminReq = { admin: { sub: string } };
type Json = Record<string, unknown>;

const TOTP_HEADER = "x-totp-code";
const FULFILLMENT_CHANNELS = ["telegram", "whatsapp"] as const;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function activityRangeStart(range?: string): Date | undefined {
  const now = Date.now();
  switch (range) {
    case "today": {
      const wibMidnight = Math.floor((now + WIB_OFFSET_MS) / DAY_MS) * DAY_MS;
      return new Date(wibMidnight - WIB_OFFSET_MS);
    }
    case "7d":
      return new Date(now - 7 * DAY_MS);
    case "30d":
      return new Date(now - 30 * DAY_MS);
    default:
      return undefined;
  }
}

@Controller("admin")
@UseGuards(AdminAuthGuard)
export class AdminOpsController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly services: AdminServicesService,
    private readonly orders: AdminOrdersService,
    private readonly admins: AdminAdminsService,
    private readonly reports: AdminReportsService,
    private readonly totp: AdminTotpService,
    private readonly audit: AuditLogService,
    private readonly customerOrders: OrdersService,
  ) {}

  @Get("dashboard/stats")
  dashboard(@Req() req: AdminReq) {
    return this.orders.dashboardStats(req.admin.sub);
  }

  @Get("reports/summary")
  reportsSummary() {
    return this.reports.summary();
  }

  @Get("activity")
  @UseGuards(SuperAdminGuard)
  listActivity(
    @Query("category") category?: string,
    @Query("q") q?: string,
    @Query("range") range?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.audit.list({
      category: category && category !== "all" ? category.slice(0, 20) : undefined,
      q: q?.slice(0, 100),
      from: activityRangeStart(range),
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 50,
    });
  }

  @Get("users")
  @UseGuards(SuperAdminGuard)
  listUsers(@Query("q") q?: string) {
    return this.users.list(q);
  }

  @Post("users")
  @UseGuards(SuperAdminGuard)
  async createUser(@Req() req: AdminReq, @Body() body: Json) {
    const user = await this.users.create({
      username: optString(body.username, "Username", 64),
      fullName: optString(body.fullName, "Nama lengkap", 120),
      password: optString(body.password, "Password", 200),
      telegramHandle: optNullableString(body.telegramHandle, "Telegram", 64),
      customPrices: optServicePrices(body.customPrices, "Harga khusus"),
      botAccess: optBoolean(body.botAccess, "Akses bot"),
    });
    this.audit.record("admin.user.created", {
      actorId: req.admin.sub,
      userId: user.id,
    });
    return user;
  }

  @Patch("users/:id")
  @UseGuards(SuperAdminGuard)
  async updateUser(
    @Req() req: AdminReq,
    @Param("id") id: string,
    @Body() body: Json,
  ) {
    const input = {
      fullName: optString(body.fullName, "Nama lengkap", 120),
      telegramHandle: optNullableString(body.telegramHandle, "Telegram", 64),
      customPrices: optServicePrices(body.customPrices, "Harga khusus"),
      status: optEnum(body.status, ["active", "suspended"] as const, "Status"),
      botAccess: optBoolean(body.botAccess, "Akses bot"),
      password: optString(body.password, "Password", 200),
    };
    const user = await this.users.update(id, input);
    this.audit.record("admin.user.updated", {
      actorId: req.admin.sub,
      userId: id,
      status: input.status,
      passwordReset: Boolean(input.password),
    });
    return user;
  }

  @Delete("users/:id")
  @UseGuards(SuperAdminGuard)
  async deleteUser(@Req() req: AdminReq, @Param("id") id: string) {
    const result = await this.users.remove(id);
    this.audit.record("admin.user.deleted", {
      actorId: req.admin.sub,
      userId: id,
      hardDeleted: result.deleted,
    });
    return result;
  }

  @Get("services")
  @UseGuards(SuperAdminGuard)
  listServices() {
    return this.services.list();
  }

  @Post("services")
  @UseGuards(SuperAdminGuard)
  async createService(@Req() req: AdminReq, @Body() body: Json) {
    const service = await this.services.create({
      code: optString(body.code, "Code", 40),
      name: optString(body.name, "Nama", 120),
      description: optString(body.description, "Deskripsi", 1000),
      price: optNonNegativeInt(body.price, "Harga"),
      estimate: optString(body.estimate, "Estimasi", 60),
      active: optBoolean(body.active, "Aktif"),
      fulfillmentChannel: optEnum(body.fulfillmentChannel, FULFILLMENT_CHANNELS, "Jalur proses"),
      assignedAdminIds: optIdList(body.assignedAdminIds, "Assign admin"),
    });
    this.audit.record("admin.service.created", {
      actorId: req.admin.sub,
      serviceId: service.id,
      serviceName: service.name,
      assignedAdmins: service.assignedAdmins.map((a) => a.id).join(","),
    });
    return service;
  }

  @Patch("services/:id")
  @UseGuards(SuperAdminGuard)
  async updateService(
    @Req() req: AdminReq,
    @Param("id") id: string,
    @Body() body: Json,
  ) {
    const input = {
      name: optString(body.name, "Nama", 120),
      description: optString(body.description, "Deskripsi", 1000),
      price: optNonNegativeInt(body.price, "Harga"),
      estimate: optString(body.estimate, "Estimasi", 60),
      active: optBoolean(body.active, "Aktif"),
      fulfillmentChannel: optEnum(body.fulfillmentChannel, FULFILLMENT_CHANNELS, "Jalur proses"),
      assignedAdminIds: optIdList(body.assignedAdminIds, "Assign admin"),
    };
    const service = await this.services.update(id, input);
    this.audit.record("admin.service.updated", {
      actorId: req.admin.sub,
      serviceId: id,
      serviceName: service.name,
      price: input.price,
      active: input.active,
      fulfillmentChannel: input.fulfillmentChannel,
      assignedAdmins: input.assignedAdminIds?.join(","),
    });
    return service;
  }

  @Get("orders")
  listOrders(
    @Req() req: AdminReq,
    @Query("q") q?: string,
    @Query("status") status?: string,
  ) {
    return this.orders.list(req.admin.sub, q, status);
  }

  @Get("orders/:orderId")
  getOrder(@Req() req: AdminReq, @Param("orderId") orderId: string) {
    return this.orders.get(req.admin.sub, orderId);
  }

  @Patch("orders/:orderId/status")
  @UseGuards(SuperAdminGuard)
  async overrideStatus(
    @Req() req: AdminReq,
    @Param("orderId") orderId: string,
    @Body() body: Json,
  ) {
    const status = String(optString(body.status, "Status", 40) ?? "");
    const order = await this.orders.overrideStatus(
      req.admin.sub,
      orderId,
      status,
      optString(body.note, "Catatan", 500),
    );
    this.audit.record("admin.order.status_override", {
      actorId: req.admin.sub,
      orderId,
      status,
    });
    return order;
  }

  @Post("orders/:orderId/cancel")
  @UseGuards(SuperAdminGuard)
  async cancelOrder(
    @Req() req: AdminReq,
    @Param("orderId") orderId: string,
    @Body() body: Json,
  ) {
    return this.customerOrders.adminCancelOrder(
      req.admin.sub,
      orderId,
      optString(body.reason, "Alasan", 500),
    );
  }

  @Get("admins")
  @UseGuards(SuperAdminGuard)
  listAdmins(@Query("q") q?: string) {
    return this.admins.list(q);
  }

  @Post("admins")
  @UseGuards(SuperAdminGuard)
  @Throttle(SENSITIVE_THROTTLE)
  async createAdmin(
    @Req() req: AdminReq,
    @Body() body: Json,
    @Headers(TOTP_HEADER) totpCode?: string,
  ) {
    const input = {
      username: optString(body.username, "Username", 64),
      fullName: optString(body.fullName, "Nama lengkap", 120),
      password: optString(body.password, "Password", 200),
      role: optEnum(body.role, ["admin", "super_admin"] as const, "Role"),
    };
    await this.totp.assertStepUp(req.admin.sub, totpCode);
    const admin = await this.admins.create(input);
    this.audit.record("admin.admin.created", {
      actorId: req.admin.sub,
      adminId: admin.id,
      role: admin.role,
    });
    return admin;
  }

  @Patch("admins/:id")
  @UseGuards(SuperAdminGuard)
  @Throttle(SENSITIVE_THROTTLE)
  async updateAdmin(
    @Req() req: AdminReq,
    @Param("id") id: string,
    @Body() body: Json,
    @Headers(TOTP_HEADER) totpCode?: string,
  ) {
    const input = {
      fullName: optString(body.fullName, "Nama lengkap", 120),
      role: optEnum(body.role, ["admin", "super_admin"] as const, "Role"),
      status: optEnum(body.status, ["active", "blocked"] as const, "Status"),
      password: optString(body.password, "Password", 200),
    };
    await this.totp.assertStepUp(req.admin.sub, totpCode);
    const admin = await this.admins.update(req.admin.sub, id, input);
    this.audit.record("admin.admin.updated", {
      actorId: req.admin.sub,
      adminId: id,
      role: input.role,
      status: input.status,
      passwordReset: Boolean(input.password),
    });
    return admin;
  }

  @Delete("admins/:id")
  @UseGuards(SuperAdminGuard)
  @Throttle(SENSITIVE_THROTTLE)
  async deleteAdmin(
    @Req() req: AdminReq,
    @Param("id") id: string,
    @Headers(TOTP_HEADER) totpCode?: string,
  ) {
    await this.totp.assertStepUp(req.admin.sub, totpCode);
    const result = await this.admins.remove(req.admin.sub, id);
    this.audit.record("admin.admin.deleted", {
      actorId: req.admin.sub,
      adminId: id,
      hardDeleted: result.deleted,
    });
    return result;
  }
}
