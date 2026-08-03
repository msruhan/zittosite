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
import { UserAuthService } from "./user-auth.service";
import { UserAuthGuard } from "./user-auth.guard";
import {
  clearUserAuthCookie,
  setUserAuthCookie,
  USER_AUTH_COOKIE,
  extractAuthToken,
} from "./auth-cookies";
import { clientMetaFromReq } from "./client-meta";

@Controller()
export class UserAuthController {
  constructor(private readonly auth: UserAuthService) {}

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
    setUserAuthCookie(res, result.accessToken);
    return { user: result.user };
  }

  @Post("auth/logout")
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    try {
      const token = extractAuthToken(req, USER_AUTH_COOKIE);
      if (token) {
        const session = await this.auth.verifyToken(token);
        await this.auth.logout(session.userId, session.sessionId);
      }
    } catch {
      /* already invalid — still clear cookie */
    }
    clearUserAuthCookie(res);
    return { ok: true };
  }

  @Get("me")
  @UseGuards(UserAuthGuard)
  me(@Req() req: any) {
    return this.auth.me(req.user.sub);
  }

  @Post("me/password")
  @UseGuards(UserAuthGuard)
  async changePassword(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { currentPassword?: string; newPassword?: string },
  ) {
    const result = await this.auth.changePassword(
      req.user.sub,
      String(body.currentPassword ?? ""),
      String(body.newPassword ?? ""),
    );
    clearUserAuthCookie(res);
    return result;
  }
}
