import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { PrismaService } from "../prisma/prisma.service";
import { getAdminJwtSecret } from "../config/env";
import type { ClientMeta } from "../auth/client-meta";
import { AdminTotpService } from "./admin-totp.service";

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly totp: AdminTotpService,
  ) {}

  private sign(adminId: string, username: string, sessionId: string) {
    return jwt.sign(
      { sub: adminId, username, role: "admin", jti: sessionId },
      getAdminJwtSecret(),
      { expiresIn: "12h" },
    );
  }

  private signPending(adminId: string) {
    return jwt.sign(
      { sub: adminId, purpose: "admin_totp" },
      getAdminJwtSecret(),
      { expiresIn: "5m" },
    );
  }

  async login(rawUsername: string, password: string, meta: ClientMeta = {}) {
    const username = String(rawUsername ?? "").trim().toLowerCase();
    const admin = await this.prisma.admin.findUnique({ where: { username } });
    if (!admin || admin.status !== "active") {
      throw new UnauthorizedException("Username atau password salah.");
    }
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Username atau password salah.");
    }

    if (await this.totp.needsLoginTotp(admin)) {
      return {
        requiresTotp: true as const,
        pendingToken: this.signPending(admin.id),
        admin: { username: admin.username, fullName: admin.fullName },
      };
    }

    return this.issueSession(admin.id, admin.username, admin.fullName, meta);
  }

  async verifyLoginTotp(
    pendingToken: string,
    code: string,
    meta: ClientMeta = {},
  ) {
    let payload: { sub?: string; purpose?: string };
    try {
      payload = jwt.verify(String(pendingToken ?? ""), getAdminJwtSecret()) as {
        sub?: string;
        purpose?: string;
      };
    } catch {
      throw new UnauthorizedException(
        "Sesi verifikasi kedaluwarsa. Login ulang.",
      );
    }
    if (payload.purpose !== "admin_totp" || !payload.sub) {
      throw new UnauthorizedException("Token verifikasi tidak valid.");
    }
    const ok = await this.totp.verifyForAdmin(payload.sub, code);
    if (!ok) {
      throw new UnauthorizedException("Kode authenticator salah.");
    }
    const admin = await this.prisma.admin.findUniqueOrThrow({
      where: { id: payload.sub },
      select: { id: true, username: true, fullName: true, status: true },
    });
    if (admin.status !== "active") {
      throw new UnauthorizedException("Akun admin tidak aktif.");
    }
    return this.issueSession(admin.id, admin.username, admin.fullName, meta);
  }

  private async issueSession(
    adminId: string,
    username: string,
    fullName: string,
    meta: ClientMeta,
  ) {
    const session = await this.prisma.adminSession.create({
      data: {
        adminId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
    const accessToken = this.sign(adminId, username, session.id);
    return {
      requiresTotp: false as const,
      accessToken,
      admin: { id: adminId, username, fullName },
    };
  }

  async logout(adminId: string, sessionId?: string) {
    if (sessionId) {
      await this.prisma.adminSession.updateMany({
        where: { id: sessionId, adminId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { ok: true };
  }

  async me(adminId: string) {
    return this.prisma.admin.findUniqueOrThrow({
      where: { id: adminId },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        status: true,
        totpEnabledAt: true,
        createdAt: true,
      },
    });
  }

  async changePassword(
    adminId: string,
    currentPassword: string,
    newPassword: string,
    totpCode?: string,
  ) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException("Password baru minimal 8 karakter.");
    }
    await this.totp.assertAction(adminId, "password", totpCode);
    const admin = await this.prisma.admin.findUniqueOrThrow({
      where: { id: adminId },
    });
    const ok = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Password saat ini salah.");
    }
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    await this.prisma.adminSession.updateMany({
      where: { adminId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async verifyToken(token: string) {
    try {
      const payload = jwt.verify(token, getAdminJwtSecret()) as {
        sub?: string;
        jti?: string;
        role?: string;
      };
      if (!payload.sub || payload.role !== "admin" || !payload.jti) {
        throw new UnauthorizedException();
      }
      const session = await this.prisma.adminSession.findFirst({
        where: {
          id: payload.jti,
          adminId: payload.sub,
          revokedAt: null,
          admin: { status: "active" },
        },
        select: { id: true },
      });
      if (!session) throw new UnauthorizedException();
      await this.prisma.adminSession.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      });
      return { adminId: payload.sub, sessionId: payload.jti };
    } catch {
      throw new UnauthorizedException("Sesi tidak valid. Silakan login ulang.");
    }
  }
}
