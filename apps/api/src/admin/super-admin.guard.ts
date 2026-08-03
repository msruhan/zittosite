import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Requires AdminAuthGuard first (req.admin.sub).
 * Loads DB role — JWT does not carry AdminRole.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const adminId = req.admin?.sub as string | undefined;
    if (!adminId) throw new UnauthorizedException("Login admin diperlukan.");

    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: { role: true, status: true },
    });
    if (!admin || admin.status !== "active") {
      throw new UnauthorizedException("Login admin diperlukan.");
    }
    if (admin.role !== "super_admin") {
      throw new ForbiddenException(
        "Hanya Super Admin yang dapat mengelola akun admin.",
      );
    }
    return true;
  }
}
