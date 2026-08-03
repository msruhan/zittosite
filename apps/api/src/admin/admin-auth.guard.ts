import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AdminAuthService } from "./admin-auth.service";
import { ADMIN_AUTH_COOKIE, extractAuthToken } from "../auth/auth-cookies";

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly auth: AdminAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = extractAuthToken(req, ADMIN_AUTH_COOKIE);
    if (!token) throw new UnauthorizedException("Login admin diperlukan.");
    const session = await this.auth.verifyToken(token);
    req.admin = { sub: session.adminId, sessionId: session.sessionId };
    return true;
  }
}
