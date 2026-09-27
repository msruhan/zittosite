import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { PrismaService } from "../prisma/prisma.service";
import { getUserJwtSecret } from "../config/env";
import { AuditLogService } from "../security/audit-log.service";
import { LoginAttemptService } from "../security/login-attempt.service";
import { DUMMY_PASSWORD_HASH, passwordPolicyError } from "../security/password";
import type { ClientMeta } from "./client-meta";

@Injectable()
export class UserAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attempts: LoginAttemptService,
    private readonly audit: AuditLogService,
  ) {}

  private sign(userId: string, username: string, sessionId: string) {
    return jwt.sign(
      { sub: userId, username, role: "user", jti: sessionId },
      getUserJwtSecret(),
      { expiresIn: "12h", algorithm: "HS256" },
    );
  }

  async login(rawUsername: string, password: string, meta: ClientMeta = {}) {
    const username = String(rawUsername ?? "").trim().toLowerCase().slice(0, 64);
    const lockKey = `user:${username}`;
    this.attempts.assertNotLocked(lockKey);

    const user = await this.prisma.user.findUnique({ where: { username } });
    const ok = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || user.status !== "active" || !ok) {
      const locked = this.attempts.recordFailure(lockKey);
      this.audit.record(locked ? "auth.user.locked" : "auth.user.login_failed", {
        username,
        ip: meta.ip,
      });
      throw new UnauthorizedException("Username atau password salah.");
    }
    this.attempts.recordSuccess(lockKey);
    this.audit.record("auth.user.login_success", {
      userId: user.id,
      ip: meta.ip,
    });

    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
    const accessToken = this.sign(user.id, user.username, session.id);
    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
      },
    };
  }

  async logout(userId: string, sessionId?: string) {
    if (sessionId) {
      await this.prisma.userSession.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        telegramHandle: true,
        customPrice: true,
        creditBalance: true,
        status: true,
        botAccess: true,
        createdAt: true,
      },
    });
    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const policyError = passwordPolicyError(String(newPassword ?? ""));
    if (policyError) throw new BadRequestException(policyError);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Password saat ini salah.");
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.audit.record("auth.user.password_changed", { userId });
    return { ok: true };
  }

  async verifyToken(token: string) {
    try {
      const payload = jwt.verify(token, getUserJwtSecret(), {
        algorithms: ["HS256"],
      }) as {
        sub?: string;
        jti?: string;
        role?: string;
      };
      if (!payload.sub || payload.role !== "user" || !payload.jti) {
        throw new UnauthorizedException();
      }
      const session = await this.prisma.userSession.findFirst({
        where: {
          id: payload.jti,
          userId: payload.sub,
          revokedAt: null,
          user: { status: "active" },
        },
        select: { id: true },
      });
      if (!session) throw new UnauthorizedException();
      await this.prisma.userSession.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      });
      return { userId: payload.sub, sessionId: payload.jti };
    } catch {
      throw new UnauthorizedException("Sesi tidak valid. Silakan login ulang.");
    }
  }
}
