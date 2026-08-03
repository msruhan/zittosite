import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { UserAuthGuard } from "../auth/user-auth.guard";
import { AdminAuthGuard } from "../admin/admin-auth.guard";
import { AdminTotpService } from "../admin/admin-totp.service";
import {
  oauthCookieName,
  oauthCookieOptions,
} from "./telegram-oauth-cookie";
import { TelegramOauthService } from "./telegram-oauth.service";

function clearOauthCookie(response: Response, actorType: "user" | "admin") {
  const { maxAge: _maxAge, ...options } = oauthCookieOptions(actorType);
  response.clearCookie(oauthCookieName(actorType), options);
}

@Controller("me/telegram")
@UseGuards(UserAuthGuard)
export class UserTelegramOauthController {
  constructor(private readonly oauth: TelegramOauthService) {}

  @Post("oauth/start")
  async start(@Req() req: any, @Res({ passthrough: true }) response: Response) {
    const result = await this.oauth.start("user", req.user.sub);
    response.cookie(
      result.cookie.cookieName,
      result.cookie.cookieValue,
      result.cookie.cookieOptions,
    );
    return { authorizationUrl: result.authorizationUrl };
  }

  @Post("oauth/complete")
  async complete(
    @Req() req: any,
    @Res({ passthrough: true }) response: Response,
    @Body() body: { code?: string; state?: string },
  ) {
    const cookieValue = req.cookies?.[oauthCookieName("user")];
    clearOauthCookie(response, "user");
    return this.oauth.complete({
      actorType: "user",
      actorId: req.user.sub,
      code: String(body.code ?? ""),
      state: String(body.state ?? ""),
      cookieValue,
    });
  }

  @Get("status")
  status(@Req() req: any) {
    return this.oauth.userStatus(req.user.sub);
  }

  @Delete()
  unlink(@Req() req: any) {
    return this.oauth.unlinkUser(req.user.sub);
  }
}

@Controller("admin/settings/telegram")
@UseGuards(AdminAuthGuard)
export class AdminTelegramOauthController {
  constructor(
    private readonly oauth: TelegramOauthService,
    private readonly totp: AdminTotpService,
  ) {}

  @Post("oauth/start")
  async start(
    @Req() req: any,
    @Res({ passthrough: true }) response: Response,
    @Body() body: { totpCode?: string },
  ) {
    const totpStatus = await this.totp.status(req.admin.sub);
    if (!totpStatus.enabled) {
      throw new ForbiddenException(
        "Aktifkan Google Authenticator sebelum menautkan Telegram.",
      );
    }
    const ok = await this.totp.verifyForAdmin(
      req.admin.sub,
      String(body.totpCode ?? ""),
    );
    if (!ok) {
      throw new UnauthorizedException(
        "Kode authenticator salah atau diperlukan.",
      );
    }
    const result = await this.oauth.start("admin", req.admin.sub);
    response.cookie(
      result.cookie.cookieName,
      result.cookie.cookieValue,
      result.cookie.cookieOptions,
    );
    return { authorizationUrl: result.authorizationUrl };
  }

  @Post("oauth/complete")
  async complete(
    @Req() req: any,
    @Res({ passthrough: true }) response: Response,
    @Body() body: { code?: string; state?: string },
  ) {
    const cookieValue = req.cookies?.[oauthCookieName("admin")];
    clearOauthCookie(response, "admin");
    return this.oauth.complete({
      actorType: "admin",
      actorId: req.admin.sub,
      code: String(body.code ?? ""),
      state: String(body.state ?? ""),
      cookieValue,
    });
  }

  @Get()
  status(@Req() req: any) {
    return this.oauth.adminStatus(req.admin.sub);
  }

  @Delete()
  unlink(@Req() req: any) {
    return this.oauth.unlinkAdmin(req.admin.sub);
  }
}
