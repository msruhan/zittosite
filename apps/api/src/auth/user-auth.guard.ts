import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { UserAuthService } from "./user-auth.service";
import { USER_AUTH_COOKIE, extractAuthToken } from "./auth-cookies";

@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(private readonly auth: UserAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = extractAuthToken(req, USER_AUTH_COOKIE);
    if (!token) throw new UnauthorizedException("Login diperlukan.");
    const session = await this.auth.verifyToken(token);
    req.user = { sub: session.userId, sessionId: session.sessionId };
    return true;
  }
}
