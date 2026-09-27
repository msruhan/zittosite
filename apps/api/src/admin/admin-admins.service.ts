import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import type {
  Admin,
  AdminRole,
  AdminStatus,
  AdminTelegramInvite,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { passwordPolicyError } from "../security/password";

const ADMIN_INCLUDE = {
  _count: { select: { assignedOrders: true } },
  telegramInvites: {
    where: { status: { in: ["pending", "claimed"] } },
    orderBy: { createdAt: "desc" },
    take: 1,
  },
} satisfies Prisma.AdminInclude;

function serializeInvite(invite: AdminTelegramInvite | undefined) {
  if (!invite) return null;
  if (invite.status === "pending" && invite.expiresAt <= new Date()) {
    return null;
  }
  return {
    status: invite.status as "pending" | "claimed",
    expiresAt: invite.expiresAt.toISOString(),
    telegramUsername: invite.claimUsername,
    telegramName: invite.claimName,
    telegramUserId: invite.claimTelegramUserId,
    claimedAt: invite.claimedAt?.toISOString() ?? null,
  };
}

export function serializeAdminAccount(
  admin: Admin & {
    _count?: { assignedOrders: number };
    telegramInvites?: AdminTelegramInvite[];
  },
) {
  const handle = admin.telegramUsername?.trim();
  return {
    id: admin.id,
    username: admin.username,
    fullName: admin.fullName,
    role: admin.role,
    telegramHandle: handle
      ? handle.startsWith("@")
        ? handle
        : `@${handle}`
      : null,
    telegramLinked: Boolean(admin.telegramChatId),
    telegramInvite: serializeInvite(admin.telegramInvites?.[0]),
    active: admin.status === "active",
    handledCount: admin._count?.assignedOrders ?? 0,
    totpEnabled: Boolean(admin.totpEnabledAt),
    createdAt: admin.createdAt.toISOString(),
  };
}

/** Operators never sign in on the web, so they get a random, never-shared password. */
function unusablePasswordHash() {
  return bcrypt.hash(randomBytes(32).toString("base64url"), 10);
}

@Injectable()
export class AdminAdminsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q?: string) {
    const needle = String(q ?? "").trim();
    const admins = await this.prisma.admin.findMany({
      where: needle
        ? {
            OR: [
              { username: { contains: needle, mode: "insensitive" } },
              { fullName: { contains: needle, mode: "insensitive" } },
              { telegramUsername: { contains: needle, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: ADMIN_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return admins.map(serializeAdminAccount);
  }

  async create(input: {
    username?: string;
    fullName?: string;
    password?: string;
    role?: AdminRole;
  }) {
    const username = String(input.username ?? "")
      .trim()
      .toLowerCase();
    const fullName = String(input.fullName ?? "").trim();
    const password = String(input.password ?? "");
    const role = input.role ?? "admin";

    if (!username || !fullName) {
      throw new BadRequestException("Username dan nama lengkap wajib.");
    }
    if (role !== "admin" && role !== "super_admin") {
      throw new BadRequestException("Role tidak valid.");
    }
    if (role === "super_admin") {
      const policyError = passwordPolicyError(password);
      if (policyError) throw new BadRequestException(policyError);
    }

    const exists = await this.prisma.admin.findUnique({ where: { username } });
    if (exists) throw new ConflictException("Username sudah dipakai.");

    const admin = await this.prisma.admin.create({
      data: {
        username,
        fullName,
        passwordHash:
          role === "super_admin"
            ? await bcrypt.hash(password, 10)
            : await unusablePasswordHash(),
        role,
        status: "active",
      },
      include: ADMIN_INCLUDE,
    });
    return serializeAdminAccount(admin);
  }

  async update(
    actorId: string,
    id: string,
    input: {
      fullName?: string;
      role?: AdminRole;
      status?: AdminStatus;
      password?: string;
    },
  ) {
    const existing = await this.prisma.admin.findUnique({
      where: { id },
      include: { _count: { select: { assignedOrders: true } } },
    });
    if (!existing) throw new NotFoundException("Admin tidak ditemukan.");

    if (input.status === "blocked" && id === actorId) {
      throw new BadRequestException("Tidak dapat memblokir akun sendiri.");
    }

    if (
      input.role &&
      input.role !== "admin" &&
      input.role !== "super_admin"
    ) {
      throw new BadRequestException("Role tidak valid.");
    }
    if (
      input.status &&
      input.status !== "active" &&
      input.status !== "blocked"
    ) {
      throw new BadRequestException("Status tidak valid.");
    }

    const nextRole = input.role ?? existing.role;
    const password =
      input.password && nextRole === "super_admin" ? String(input.password) : "";
    const policyError = password ? passwordPolicyError(password) : null;
    if (policyError) throw new BadRequestException(policyError);
    const promoting = existing.role !== "super_admin" && nextRole === "super_admin";
    if (promoting && !password) {
      throw new BadRequestException(
        "Tetapkan password baru saat menjadikan operator Super Admin.",
      );
    }
    const demoting = existing.role === "super_admin" && nextRole === "admin";

    if (
      existing.role === "super_admin" &&
      (input.role === "admin" || input.status === "blocked")
    ) {
      await this.assertNotLastSuperAdmin(id);
    }

    const admin = await this.prisma.admin.update({
      where: { id },
      data: {
        ...(input.fullName != null
          ? { fullName: String(input.fullName).trim() }
          : {}),
        ...(input.role ? { role: input.role } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
        ...(demoting ? { passwordHash: await unusablePasswordHash() } : {}),
      },
      include: ADMIN_INCLUDE,
    });

    if (input.status === "blocked" || password || demoting) {
      await this.revokeSessions(id);
    }

    return serializeAdminAccount(admin);
  }

  async remove(actorId: string, id: string) {
    if (id === actorId) {
      throw new BadRequestException("Tidak dapat menghapus akun sendiri.");
    }

    const existing = await this.prisma.admin.findUnique({
      where: { id },
      include: {
        _count: {
          select: { assignedOrders: true, orderResults: true },
        },
      },
    });
    if (!existing) throw new NotFoundException("Admin tidak ditemukan.");

    if (existing.role === "super_admin") {
      await this.assertNotLastSuperAdmin(id);
    }

    const hasHistory =
      existing._count.assignedOrders > 0 || existing._count.orderResults > 0;

    if (hasHistory) {
      const admin = await this.prisma.admin.update({
        where: { id },
        data: { status: "blocked" },
        include: ADMIN_INCLUDE,
      });
      await this.revokeSessions(id);
      return {
        deleted: false,
        blocked: true,
        admin: serializeAdminAccount(admin),
        message:
          "Admin punya riwayat order — status diubah ke blocked, bukan dihapus.",
      };
    }

    await this.prisma.admin.delete({ where: { id } });
    return { deleted: true, blocked: false };
  }

  private async revokeSessions(adminId: string) {
    await this.prisma.adminSession.updateMany({
      where: { adminId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async assertNotLastSuperAdmin(id: string) {
    const others = await this.prisma.admin.count({
      where: {
        role: "super_admin",
        status: "active",
        id: { not: id },
      },
    });
    if (others === 0) {
      throw new BadRequestException(
        "Tidak dapat menonaktifkan Super Admin terakhir.",
      );
    }
  }
}
