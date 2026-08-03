import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { AdminAuthService } from "./admin-auth.service";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminTotpService } from "./admin-totp.service";
import {
  clearAdminAuthCookie,
  setAdminAuthCookie,
  ADMIN_AUTH_COOKIE,
  extractAuthToken,
} from "../auth/auth-cookies";
import { clientMetaFromReq } from "../auth/client-meta";

@Controller("admin")
export class AdminAuthController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly totp: AdminTotpService,
  ) {}

  @Post("auth/login")
  async login(
    @Body() body: { username?: string; password?: string },
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(
      String(body.username ?? ""),
      String(body.password ?? ""),
      clientMetaFromReq(req),
    );
    if (result.requiresTotp) {
      return {
        requiresTotp: true,
        pendingToken: result.pendingToken,
        admin: result.admin,
      };
    }
    setAdminAuthCookie(res, result.accessToken);
    return { requiresTotp: false, admin: result.admin };
  }

  @Post("auth/totp")
  async loginTotp(
    @Body() body: { pendingToken?: string; code?: string },
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.verifyLoginTotp(
      String(body.pendingToken ?? ""),
      String(body.code ?? ""),
      clientMetaFromReq(req),
    );
    setAdminAuthCookie(res, result.accessToken);
    return { requiresTotp: false, admin: result.admin };
  }

  @Post("auth/logout")
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    try {
      const token = extractAuthToken(req, ADMIN_AUTH_COOKIE);
      if (token) {
        const session = await this.auth.verifyToken(token);
        await this.auth.logout(session.adminId, session.sessionId);
      }
    } catch {
      /* already invalid — still clear cookie */
    }
    clearAdminAuthCookie(res);
    return { ok: true };
  }

  @Get("me")
  @UseGuards(AdminAuthGuard)
  me(@Req() req: any) {
    return this.auth.me(req.admin.sub);
  }

  @Post("me/password")
  @UseGuards(AdminAuthGuard)
  async changePassword(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
    @Body()
    body: {
      currentPassword?: string;
      newPassword?: string;
      totpCode?: string;
    },
  ) {
    const result = await this.auth.changePassword(
      req.admin.sub,
      String(body.currentPassword ?? ""),
      String(body.newPassword ?? ""),
      body.totpCode,
    );
    clearAdminAuthCookie(res);
    return result;
  }

  @Get("me/totp")
  @UseGuards(AdminAuthGuard)
  totpStatus(@Req() req: any) {
    return this.totp.status(req.admin.sub);
  }

  @Post("me/totp/setup")
  @UseGuards(AdminAuthGuard)
  totpSetup(@Req() req: any) {
    return this.totp.beginSetup(req.admin.sub);
  }

  @Post("me/totp/enable")
  @UseGuards(AdminAuthGuard)
  totpEnable(@Req() req: any, @Body() body: { code?: string }) {
    return this.totp.enable(req.admin.sub, String(body.code ?? ""));
  }

  @Post("me/totp/disable")
  @UseGuards(AdminAuthGuard)
  totpDisable(
    @Req() req: any,
    @Body() body: { password?: string; code?: string },
  ) {
    return this.totp.disable(
      req.admin.sub,
      String(body.password ?? ""),
      String(body.code ?? ""),
    );
  }
}
