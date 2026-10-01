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
import { UserAuthGuard } from "../auth/user-auth.guard";
import { AdminAuthGuard } from "../admin/admin-auth.guard";
import { SuperAdminGuard } from "../admin/super-admin.guard";
import { AuditLogService } from "../security/audit-log.service";
import { optBoolean, optEnum, optNullableString, optString } from "../security/input";
import { RUNNING_AD_COLORS, RunningAdsService } from "./running-ads.service";

type AdminReq = { admin: { sub: string } };
type Json = Record<string, unknown>;

function parseInput(body: Json) {
  return {
    text: optString(body.text, "Teks", 200),
    linkUrl: optNullableString(body.linkUrl, "Link", 500),
    tag: optNullableString(body.tag, "Label", 16),
    tagColor: optEnum(body.tagColor, RUNNING_AD_COLORS, "Warna label"),
    isActive: optBoolean(body.isActive, "Aktif"),
  };
}

@Controller("running-ads")
@UseGuards(UserAuthGuard)
export class RunningAdsController {
  constructor(private readonly ads: RunningAdsService) {}

  @Get()
  list() {
    return this.ads.listActive();
  }
}

@Controller("admin/running-ads")
@UseGuards(AdminAuthGuard, SuperAdminGuard)
export class AdminRunningAdsController {
  constructor(
    private readonly ads: RunningAdsService,
    private readonly audit: AuditLogService,
  ) {}

  @Get()
  list() {
    return this.ads.list();
  }

  @Post()
  async create(@Req() req: AdminReq, @Body() body: Json) {
    const ad = await this.ads.create(parseInput(body));
    this.audit.record("admin.running_ad.created", {
      actorId: req.admin.sub,
      adId: ad.id,
      text: ad.text.slice(0, 120),
    });
    return ad;
  }

  @Patch(":id")
  async update(@Req() req: AdminReq, @Param("id") id: string, @Body() body: Json) {
    const input = parseInput(body);
    const ad = await this.ads.update(id, input);
    this.audit.record("admin.running_ad.updated", {
      actorId: req.admin.sub,
      adId: ad.id,
      text: ad.text.slice(0, 120),
      active: input.isActive,
    });
    return ad;
  }

  @Post(":id/move")
  move(@Param("id") id: string, @Body() body: Json) {
    return this.ads.move(id, optEnum(body.direction, ["up", "down"] as const, "Arah") ?? "up");
  }

  @Delete(":id")
  async remove(@Req() req: AdminReq, @Param("id") id: string) {
    const ad = await this.ads.remove(id);
    this.audit.record("admin.running_ad.deleted", {
      actorId: req.admin.sub,
      adId: ad.id,
      text: ad.text.slice(0, 120),
    });
    return { ok: true };
  }
}
