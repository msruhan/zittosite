import {
  Controller,
  Delete,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AdminAuthGuard } from "../admin/admin-auth.guard";
import { AdminTotpService } from "../admin/admin-totp.service";
import { SuperAdminGuard } from "../admin/super-admin.guard";
import { SENSITIVE_THROTTLE } from "../security/throttle";
import { AdminTelegramInviteService } from "./admin-telegram-invite.service";

type AdminReq = { admin: { sub: string } };

const TOTP_HEADER = "x-totp-code";

@Controller("admin/admins/:id/telegram")
@UseGuards(AdminAuthGuard, SuperAdminGuard)
@Throttle(SENSITIVE_THROTTLE)
export class AdminTelegramInviteController {
  constructor(
    private readonly invites: AdminTelegramInviteService,
    private readonly totp: AdminTotpService,
  ) {}

  @Post("invite")
  async createInvite(
    @Req() req: AdminReq,
    @Param("id") id: string,
    @Headers(TOTP_HEADER) totpCode?: string,
  ) {
    await this.totp.assertStepUp(req.admin.sub, totpCode);
    return this.invites.create(req.admin.sub, id);
  }

  @Delete("invite")
  revokeInvite(@Req() req: AdminReq, @Param("id") id: string) {
    return this.invites.revoke(req.admin.sub, id);
  }

  @Post("approve")
  async approve(
    @Req() req: AdminReq,
    @Param("id") id: string,
    @Headers(TOTP_HEADER) totpCode?: string,
  ) {
    await this.totp.assertStepUp(req.admin.sub, totpCode);
    return this.invites.approveForAdmin(req.admin.sub, id);
  }

  @Post("reject")
  reject(@Req() req: AdminReq, @Param("id") id: string) {
    return this.invites.rejectForAdmin(req.admin.sub, id);
  }

  @Delete()
  async unlink(
    @Req() req: AdminReq,
    @Param("id") id: string,
    @Headers(TOTP_HEADER) totpCode?: string,
  ) {
    await this.totp.assertStepUp(req.admin.sub, totpCode);
    return this.invites.unlink(req.admin.sub, id);
  }
}
