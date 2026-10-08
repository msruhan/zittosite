import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Put,
  Post,
  Query,
  Req,
  StreamableFile,
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
import { AdminReportsService, parseReportPeriod } from "./admin-reports.service";
import { AdminTotpService } from "./admin-totp.service";
import { RICH_DESCRIPTION_MAX } from "./rich-description";
import { AuditLogService } from "../security/audit-log.service";
import { SENSITIVE_THROTTLE } from "../security/throttle";
import { parseAdjustment } from "../orders/balance";
import { type PriceAdjustment, ROUND_TO } from "./service-group-pricing";
import { parseUsdCents, parseUsdRate } from "../orders/usd-pricing";
import { UsdRateService } from "../orders/usd-rate.service";
import { USER_MENU_KEYS, parseUserMenusInput } from "../orders/user-menus";
import { UserMenusService } from "../orders/user-menus.service";
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
const FULFILLMENT_CHANNELS = ["telegram", "whatsapp", "whatsapp_admin", "supplier"] as const;
const INPUT_TYPES = ["imei", "sn", "ecid", "imei_sn", "phone", "none"] as const;
const SERVICE_MENUS = ["ceir", "special"] as const;
const USER_ROLES = ["customer", "testing"] as const;
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
    private readonly usdRate: UsdRateService,
    private readonly userMenus: UserMenusService,
  ) {}

  @Get("dashboard/stats")
  dashboard(@Req() req: AdminReq) {
    return this.orders.dashboardStats(req.admin.sub);
  }

  @Get("dashboard/insights")
  @UseGuards(SuperAdminGuard)
  dashboardInsights(
    @Query("dari") dari?: string,
    @Query("sampai") sampai?: string,
    @Query("tahun") tahun?: string,
    @Query("bulan") bulan?: string,
  ) {
    return this.reports.insights(parseReportPeriod({ dari, sampai, tahun, bulan }));
  }

  @Get("reports/summary")
  reportsSummary(
    @Req() req: AdminReq,
    @Query("dari") dari?: string,
    @Query("sampai") sampai?: string,
    @Query("tahun") tahun?: string,
    @Query("bulan") bulan?: string,
  ) {
    return this.reports.summary(
      req.admin.sub,
      parseReportPeriod({ dari, sampai, tahun, bulan }),
    );
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
      groupId: optNullableString(body.groupId, "Group", 64),
      role: optEnum(body.role, USER_ROLES, "Role"),
      botAccess: optBoolean(body.botAccess, "Akses bot"),
      apiEnabled: optBoolean(body.apiEnabled, "Akses API"),
    });
    this.audit.record("admin.user.created", {
      actorId: req.admin.sub,
      userId: user.id,
    });
    if (user.apiEnabled) {
      this.audit.record("api.access.toggled", {
        actorId: req.admin.sub,
        userId: user.id,
        enabled: true,
      });
    }
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
      groupId: optNullableString(body.groupId, "Group", 64),
      role: optEnum(body.role, USER_ROLES, "Role"),
      status: optEnum(body.status, ["active", "suspended"] as const, "Status"),
      botAccess: optBoolean(body.botAccess, "Akses bot"),
      apiEnabled: optBoolean(body.apiEnabled, "Akses API"),
      password: optString(body.password, "Password", 200),
    };
    const { user, apiAccessChanged } = await this.users.update(id, input);
    this.audit.record("admin.user.updated", {
      actorId: req.admin.sub,
      userId: id,
      status: input.status,
      passwordReset: Boolean(input.password),
      groupId: input.groupId,
      role: input.role,
    });
    if (apiAccessChanged) {
      this.audit.record("api.access.toggled", {
        actorId: req.admin.sub,
        userId: id,
        enabled: user.apiEnabled,
      });
    }
    return user;
  }

  @Put("users/:id/prices")
  @UseGuards(SuperAdminGuard)
  async updateUserPrices(
    @Req() req: AdminReq,
    @Param("id") id: string,
    @Body() body: Json,
  ) {
    const set = optServicePrices(body.set, "Harga user", 1000) ?? [];
    const setIds = new Set(set.map((p) => p.serviceId));
    const remove = (optIdList(body.remove, "Layanan", 1000) ?? []).filter(
      (s) => !setIds.has(s),
    );
    const result = await this.users.updatePrices(id, { set, remove });
    this.audit.record("admin.user.prices_updated", {
      actorId: req.admin.sub,
      userId: id,
      pricesSet: result.saved,
      pricesRemoved: result.removed,
    });
    return result.user;
  }

  @Post("users/:id/balance")
  @UseGuards(SuperAdminGuard)
  @Throttle(SENSITIVE_THROTTLE)
  async adjustUserBalance(
    @Req() req: AdminReq,
    @Param("id") id: string,
    @Body() body: Json,
  ) {
    const amount = parseAdjustment(body.amount);
    const note = String(optString(body.note, "Catatan", 300) ?? "");
    const user = await this.users.adjustBalance(req.admin.sub, id, {
      amount,
      note,
    });
    this.audit.record("admin.user.balance_adjusted", {
      actorId: req.admin.sub,
      userId: id,
      amount,
      note: note.trim(),
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

  @Get("services/whatsapp-groups")
  @UseGuards(SuperAdminGuard)
  listWhatsappGroups() {
    return this.services.whatsappGroups();
  }

  @Post("services")
  @UseGuards(SuperAdminGuard)
  async createService(@Req() req: AdminReq, @Body() body: Json) {
    const service = await this.services.create({
      code: optString(body.code, "Code", 40),
      name: optString(body.name, "Nama", 120),
      description: optString(body.description, "Deskripsi", RICH_DESCRIPTION_MAX),
      price: optNonNegativeInt(body.price, "Harga"),
      costPrice: optNonNegativeInt(body.costPrice, "Harga modal"),
      estimate: optString(body.estimate, "Estimasi", 60),
      active: optBoolean(body.active, "Aktif"),
      hidden: optBoolean(body.hidden, "Sembunyikan"),
      fulfillmentChannel: optEnum(body.fulfillmentChannel, FULFILLMENT_CHANNELS, "Jalur proses"),
      whatsappGroupId: optNullableString(body.whatsappGroupId, "Grup WhatsApp", 60),
      assignedAdminIds: optIdList(body.assignedAdminIds, "Assign admin"),
      supplierId: optNullableString(body.supplierId, "Supplier", 40),
      supplierServiceId: optNullableString(body.supplierServiceId, "Layanan supplier", 120),
      inputType: optEnum(body.inputType, INPUT_TYPES, "Jenis input"),
      menu: optEnum(body.menu, SERVICE_MENUS, "Menu layanan"),
      priceUsdCents: parseUsdCents(body.priceUsd, "Harga USD"),
      costUsdCents: parseUsdCents(body.costPriceUsd, "Harga modal USD"),
      requireQnt: optBoolean(body.requireQnt, "Field Qnt"),
      requireEmail: optBoolean(body.requireEmail, "Field Email"),
      requireUsername: optBoolean(body.requireUsername, "Field Username"),
      requireNotes: optBoolean(body.requireNotes, "Field Notes"),
      requirePassword: optBoolean(body.requirePassword, "Field Password"),
      requireKeyLock: optBoolean(body.requireKeyLock, "Field Key Lock"),
      requireSignInPicture: optBoolean(body.requireSignInPicture, "Field Picture on sign-in page"),
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
      description: optString(body.description, "Deskripsi", RICH_DESCRIPTION_MAX),
      price: optNonNegativeInt(body.price, "Harga"),
      costPrice: optNonNegativeInt(body.costPrice, "Harga modal"),
      estimate: optString(body.estimate, "Estimasi", 60),
      active: optBoolean(body.active, "Aktif"),
      hidden: optBoolean(body.hidden, "Sembunyikan"),
      fulfillmentChannel: optEnum(body.fulfillmentChannel, FULFILLMENT_CHANNELS, "Jalur proses"),
      whatsappGroupId: optNullableString(body.whatsappGroupId, "Grup WhatsApp", 60),
      assignedAdminIds: optIdList(body.assignedAdminIds, "Assign admin"),
      supplierId: optNullableString(body.supplierId, "Supplier", 40),
      supplierServiceId: optNullableString(body.supplierServiceId, "Layanan supplier", 120),
      inputType: optEnum(body.inputType, INPUT_TYPES, "Jenis input"),
      menu: optEnum(body.menu, SERVICE_MENUS, "Menu layanan"),
      priceUsdCents: parseUsdCents(body.priceUsd, "Harga USD"),
      costUsdCents: parseUsdCents(body.costPriceUsd, "Harga modal USD"),
      requireQnt: optBoolean(body.requireQnt, "Field Qnt"),
      requireEmail: optBoolean(body.requireEmail, "Field Email"),
      requireUsername: optBoolean(body.requireUsername, "Field Username"),
      requireNotes: optBoolean(body.requireNotes, "Field Notes"),
      requirePassword: optBoolean(body.requirePassword, "Field Password"),
      requireKeyLock: optBoolean(body.requireKeyLock, "Field Key Lock"),
      requireSignInPicture: optBoolean(body.requireSignInPicture, "Field Picture on sign-in page"),
    };
    const service = await this.services.update(id, input);
    this.audit.record("admin.service.updated", {
      actorId: req.admin.sub,
      serviceId: id,
      serviceName: service.name,
      price: input.price,
      costPrice: input.costPrice,
      active: input.active,
      hidden: input.hidden,
      fulfillmentChannel: input.fulfillmentChannel,
      whatsappGroupId: input.whatsappGroupId,
      inputType: input.inputType,
      requireQnt: input.requireQnt,
      requireEmail: input.requireEmail,
      requireUsername: input.requireUsername,
      requireNotes: input.requireNotes,
      requirePassword: input.requirePassword,
      requireKeyLock: input.requireKeyLock,
      requireSignInPicture: input.requireSignInPicture,
      menu: input.menu,
      assignedAdmins: input.assignedAdminIds?.join(","),
    });
    return service;
  }

  @Delete("services/:id")
  @UseGuards(SuperAdminGuard)
  async deleteService(@Req() req: AdminReq, @Param("id") id: string) {
    const removed = await this.services.remove(id);
    this.audit.record("admin.service.deleted", {
      actorId: req.admin.sub,
      serviceId: removed.id,
      serviceName: removed.name,
    });
    return { ok: true };
  }

  @Get("service-groups")
  @UseGuards(SuperAdminGuard)
  listServiceGroups() {
    return this.services.listGroups();
  }

  @Post("service-groups")
  @UseGuards(SuperAdminGuard)
  async createServiceGroup(@Req() req: AdminReq, @Body() body: Json) {
    const group = await this.services.createGroup({
      name: optString(body.name, "Nama grup", 80),
      serviceIds: optIdList(body.serviceIds, "Layanan", 500),
    });
    this.audit.record("admin.service_group.created", {
      actorId: req.admin.sub,
      groupId: group.id,
      groupName: group.name,
      serviceCount: group.serviceIds.length,
    });
    return group;
  }

  @Patch("service-groups/:id")
  @UseGuards(SuperAdminGuard)
  async updateServiceGroup(@Req() req: AdminReq, @Param("id") id: string, @Body() body: Json) {
    const group = await this.services.updateGroup(id, {
      name: optString(body.name, "Nama grup", 80),
      serviceIds: optIdList(body.serviceIds, "Layanan", 500),
    });
    this.audit.record("admin.service_group.updated", {
      actorId: req.admin.sub,
      groupId: group.id,
      groupName: group.name,
      serviceCount: group.serviceIds.length,
    });
    return group;
  }

  @Delete("service-groups/:id")
  @UseGuards(SuperAdminGuard)
  async deleteServiceGroup(@Req() req: AdminReq, @Param("id") id: string) {
    const removed = await this.services.removeGroup(id);
    this.audit.record("admin.service_group.deleted", {
      actorId: req.admin.sub,
      groupId: removed.id,
      groupName: removed.name,
    });
    return { ok: true };
  }

  @Post("service-groups/:id/adjust-price")
  @UseGuards(SuperAdminGuard)
  async adjustServiceGroupPrice(
    @Req() req: AdminReq,
    @Param("id") id: string,
    @Body() body: Json,
  ) {
    const mode = optEnum(body.mode, ["amount", "percent"] as const, "Jenis perubahan") ?? "amount";
    const value = Number(body.value);
    const roundTo = Number(body.roundToCents ?? 1);
    if (!ROUND_TO.includes(roundTo as PriceAdjustment["roundTo"])) {
      throw new BadRequestException("Pembulatan tidak valid.");
    }
    const adjustment: PriceAdjustment = {
      direction: optEnum(body.direction, ["increase", "decrease"] as const, "Arah perubahan") ?? "increase",
      mode,
      base: optEnum(body.base, ["price", "cost"] as const, "Dasar harga") ?? "price",
      // The client sends dollars for "amount"; prices are stored in cents.
      value: mode === "amount" ? Math.round(value * 100) : value,
      roundTo: roundTo as PriceAdjustment["roundTo"],
    };
    const result = await this.services.adjustGroupPrices(id, adjustment);
    this.audit.record("admin.service_group.price_adjusted", {
      actorId: req.admin.sub,
      groupId: result.groupId,
      groupName: result.groupName,
      serviceCount: result.changes.length,
      adjustment: `${adjustment.direction === "increase" ? "+" : "−"}${
        mode === "percent" ? `${value}%` : `$${value.toFixed(2)}`
      } dari ${adjustment.base === "cost" ? "harga modal" : "harga jual"}`,
    });
    return result;
  }

  @Get("user-menus")
  @UseGuards(SuperAdminGuard)
  getUserMenus() {
    return this.userMenus.get();
  }

  @Put("user-menus")
  @UseGuards(SuperAdminGuard)
  async setUserMenus(@Req() req: AdminReq, @Body() body: Json) {
    const menus = await this.userMenus.set(parseUserMenusInput(body), req.admin.sub);
    this.audit.record("admin.user_menus.updated", {
      actorId: req.admin.sub,
      summary: USER_MENU_KEYS.map(
        (key) => `${menus[key].label} (${menus[key].enabled ? "aktif" : "nonaktif"})`,
      ).join(", "),
    });
    return menus;
  }

  @Get("usd-rate")
  @UseGuards(SuperAdminGuard)
  async getUsdRate() {
    return { rate: await this.usdRate.get() };
  }

  @Patch("usd-rate")
  @UseGuards(SuperAdminGuard)
  async setUsdRate(@Req() req: AdminReq, @Body() body: Json) {
    const previous = await this.usdRate.get();
    const result = await this.usdRate.set(parseUsdRate(body.rate), req.admin.sub);
    this.audit.record("admin.usd_rate.updated", {
      actorId: req.admin.sub,
      previous,
      rate: result.rate,
      serviceCount: result.repriced,
    });
    return result;
  }

  @Get("orders")
  listOrders(
    @Req() req: AdminReq,
    @Query("q") q?: string,
    @Query("status") status?: string,
    @Query("via") via?: string,
    @Query("admin") adminId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.orders.list(req.admin.sub, q, status, via === "supplier", {
      adminId,
      from,
      to,
    });
  }

  @Get("orders-handlers")
  listOrderHandlers() {
    return this.orders.handlers();
  }

  @Get("orders/export")
  @UseGuards(SuperAdminGuard)
  @Throttle(SENSITIVE_THROTTLE)
  async exportOrders(
    @Req() req: AdminReq,
    @Query("q") q?: string,
    @Query("status") status?: string,
    @Query("admin") adminId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const { buffer, filename } = await this.orders.exportXlsx(req.admin.sub, q, status, {
      adminId,
      from,
      to,
    });
    return new StreamableFile(buffer, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      disposition: `attachment; filename="${filename}"`,
    });
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

  @Patch("orders/:orderId/reason")
  @UseGuards(SuperAdminGuard)
  async updateOrderReason(
    @Req() req: AdminReq,
    @Param("orderId") orderId: string,
    @Body() body: Json,
  ) {
    const reason = optNullableString(body.reason, "Keterangan", 500) ?? null;
    const order = await this.orders.updateStatusReason(
      req.admin.sub,
      orderId,
      reason,
    );
    this.audit.record("admin.order.reason_updated", {
      actorId: req.admin.sub,
      orderId,
      reason: order.statusReason ?? undefined,
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
      { fromWeb: true },
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
      whatsappNumber: optNullableString(body.whatsappNumber, "Nomor WhatsApp", 30),
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
      whatsappNumber: optNullableString(body.whatsappNumber, "Nomor WhatsApp", 30),
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
