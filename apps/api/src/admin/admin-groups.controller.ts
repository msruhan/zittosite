import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AdminAuthGuard } from "./admin-auth.guard";
import { SuperAdminGuard } from "./super-admin.guard";
import { AdminGroupsService } from "./admin-groups.service";
import { AuditLogService } from "../security/audit-log.service";
import { optIdList, optServicePrices, optString } from "../security/input";

type AdminReq = { admin: { sub: string } };
type Json = Record<string, unknown>;

function parseGroup(body: Json) {
  return {
    name: optString(body.name, "Nama group", 60),
    description: optString(body.description, "Deskripsi", 300),
    prices: optServicePrices(body.prices, "Harga group"),
  };
}

@Controller("admin/groups")
@UseGuards(AdminAuthGuard, SuperAdminGuard)
export class AdminGroupsController {
  constructor(
    private readonly groups: AdminGroupsService,
    private readonly audit: AuditLogService,
  ) {}

  @Get()
  list() {
    return this.groups.list();
  }

  @Post()
  async create(@Req() req: AdminReq, @Body() body: Json) {
    const group = await this.groups.create(parseGroup(body));
    this.audit.record("admin.group.created", {
      actorId: req.admin.sub,
      groupId: group.id,
      groupName: group.name,
    });
    return group;
  }

  @Patch(":id")
  async update(@Req() req: AdminReq, @Param("id") id: string, @Body() body: Json) {
    const input = parseGroup(body);
    const group = await this.groups.update(id, input);
    this.audit.record("admin.group.updated", {
      actorId: req.admin.sub,
      groupId: group.id,
      groupName: group.name,
      pricesChanged: input.prices !== undefined,
    });
    return group;
  }

  @Put(":id/prices")
  async updatePrices(@Req() req: AdminReq, @Param("id") id: string, @Body() body: Json) {
    const set = optServicePrices(body.set, "Harga group", 1000) ?? [];
    const setIds = new Set(set.map((p) => p.serviceId));
    const remove = (optIdList(body.remove, "Layanan", 1000) ?? []).filter((s) => !setIds.has(s));
    const group = await this.groups.updatePrices(id, { set, remove });
    this.audit.record("admin.group.prices_updated", {
      actorId: req.admin.sub,
      groupId: group.id,
      groupName: group.name,
      pricesSet: set.length,
      pricesRemoved: remove.length,
    });
    return group;
  }

  @Put(":id/members")
  async setMembers(@Req() req: AdminReq, @Param("id") id: string, @Body() body: Json) {
    const group = await this.groups.setMembers(id, optIdList(body.userIds, "Member", 2000) ?? []);
    this.audit.record("admin.group.members_updated", {
      actorId: req.admin.sub,
      groupId: group.id,
      groupName: group.name,
      members: group.members.length,
    });
    return group;
  }

  @Delete(":id")
  async remove(@Req() req: AdminReq, @Param("id") id: string) {
    const group = await this.groups.remove(id);
    this.audit.record("admin.group.deleted", {
      actorId: req.admin.sub,
      groupId: group.id,
      groupName: group.name,
    });
    return { ok: true };
  }
}
