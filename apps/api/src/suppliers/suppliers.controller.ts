import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AdminAuthGuard } from "../admin/admin-auth.guard";
import { SuperAdminGuard } from "../admin/super-admin.guard";
import { AuditLogService } from "../security/audit-log.service";
import { optBoolean, optEnum, optString } from "../security/input";
import { SENSITIVE_THROTTLE } from "../security/throttle";
import { SuppliersService } from "./suppliers.service";

type AdminReq = { admin: { sub: string } };
type Json = Record<string, unknown>;

const SUPPLIER_KINDS = ["dhru", "gcontact"] as const;

function parseSupplier(body: Json) {
  return {
    kind: optEnum(body.kind, SUPPLIER_KINDS, "Jenis supplier"),
    name: optString(body.name, "Nama supplier", 80),
    baseUrl: optString(body.baseUrl, "URL supplier", 300),
    username: optString(body.username, "Username", 120),
    apiKey: optString(body.apiKey, "API key", 300),
    isActive: optBoolean(body.isActive, "Aktif"),
  };
}

@Controller("admin/suppliers")
@UseGuards(AdminAuthGuard, SuperAdminGuard)
export class SuppliersController {
  constructor(
    private readonly suppliers: SuppliersService,
    private readonly audit: AuditLogService,
  ) {}

  @Get()
  list() {
    return this.suppliers.list();
  }

  @Post()
  @Throttle(SENSITIVE_THROTTLE)
  async create(@Req() req: AdminReq, @Body() body: Json) {
    const supplier = await this.suppliers.create(parseSupplier(body));
    this.audit.record("admin.supplier.created", {
      actorId: req.admin.sub,
      supplierId: supplier.id,
      supplierName: supplier.name,
      baseUrl: supplier.baseUrl,
    });
    return supplier;
  }

  @Patch(":id")
  @Throttle(SENSITIVE_THROTTLE)
  async update(@Req() req: AdminReq, @Param("id") id: string, @Body() body: Json) {
    const input = parseSupplier(body);
    const supplier = await this.suppliers.update(id, input);
    this.audit.record("admin.supplier.updated", {
      actorId: req.admin.sub,
      supplierId: supplier.id,
      supplierName: supplier.name,
      active: input.isActive,
      keyRotated: Boolean(input.apiKey),
    });
    return supplier;
  }

  @Delete(":id")
  async remove(@Req() req: AdminReq, @Param("id") id: string) {
    const supplier = await this.suppliers.remove(id);
    this.audit.record("admin.supplier.deleted", {
      actorId: req.admin.sub,
      supplierId: supplier.id,
      supplierName: supplier.name,
    });
    return { ok: true };
  }

  @Post(":id/test")
  test(@Param("id") id: string) {
    return this.suppliers.test(id);
  }

  @Post(":id/sync")
  @Throttle(SENSITIVE_THROTTLE)
  async syncPrices(@Req() req: AdminReq, @Param("id") id: string) {
    const result = await this.suppliers.syncPrices(id);
    this.audit.record("admin.supplier.synced", {
      actorId: req.admin.sub,
      supplierId: id,
      supplierName: result.supplierName,
      changed: result.changed.length,
      offline: result.offline.length,
    });
    return result;
  }

  @Get(":id/services")
  remoteServices(@Param("id") id: string) {
    return this.suppliers.remoteServices(id);
  }
}
