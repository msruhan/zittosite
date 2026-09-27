import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { PrismaService } from "../prisma/prisma.service";
import { getAdminJwtSecret } from "../config/env";
import type { ClientMeta } from "../auth/client-meta";
import { AuditLogService } from "../security/audit-log.service";
import { LoginAttemptService } from "../security/login-attempt.service";
import { DUMMY_PASSWORD_HASH, passwordPolicyError } from "../security/password";
import { AdminTotpService } from "./admin-totp.service";

const OPERATOR_WEB_DENIED =
  "Akun operator hanya dapat diakses melalui bot Telegram.";

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly totp: AdminTotpService,
    private readonly attempts: LoginAttemptService,
    private readonly audit: AuditLogService,
  ) {}

  private sign(adminId: string, username: string, sessionId: string) {
    return jwt.sign(
      { sub: adminId, username, role: "admin", jti: sessionId },
      getAdminJwtSecret(),
      { expiresIn: "12h", algorithm: "HS256" },
    );
  }

  private signPending(adminId: string) {
    return jwt.sign(
      { sub: adminId, purpose: "admin_totp" },
      getAdminJwtSecret(),
      { expiresIn: "5m", algorithm: "HS256" },
    );
  }

  async login(rawUsername: string, password: string, meta: ClientMeta = {}) {
    const username = String(rawUsername ?? "").trim().toLowerCase().slice(0, 64);
    const lockKey = `admin:${username}`;
    this.attempts.assertNotLocked(lockKey);

    const admin = await this.prisma.admin.findUnique({ where: { username } });
    const ok = await bcrypt.compare(
      password,
      admin?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!admin || admin.status !== "active" || !ok) {
      const locked = this.attempts.recordFailure(lockKey);
      this.audit.record(
        locked ? "auth.admin.locked" : "auth.admin.login_failed",
        { username, ip: meta.ip },
      );
      throw new UnauthorizedException("Username atau password salah.");
    }
    this.attempts.recordSuccess(lockKey);
    if (admin.role !== "super_admin") {
      this.audit.record("auth.admin.login_denied_operator", {
        adminId: admin.id,
        ip: meta.ip,
      });
      throw new ForbiddenException(OPERATOR_WEB_DENIED);
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
      payload = jwt.verify(String(pendingToken ?? ""), getAdminJwtSecret(), {
        algorithms: ["HS256"],
      }) as {
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
      select: {
        id: true,
        username: true,
        fullName: true,
        status: true,
        role: true,
      },
    });
    if (admin.status !== "active") {
      throw new UnauthorizedException("Akun admin tidak aktif.");
    }
    if (admin.role !== "super_admin") {
      throw new ForbiddenException(OPERATOR_WEB_DENIED);
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
    this.audit.record("auth.admin.login_success", { adminId, ip: meta.ip });
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
    const policyError = passwordPolicyError(String(newPassword ?? ""));
    if (policyError) throw new BadRequestException(policyError);
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
    this.audit.record("auth.admin.password_changed", { adminId });
    return { ok: true };
  }

  async verifyToken(token: string) {
    try {
      const payload = jwt.verify(token, getAdminJwtSecret(), {
        algorithms: ["HS256"],
      }) as {
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
          admin: { status: "active", role: "super_admin" },
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
