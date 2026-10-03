import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma, User, UserIdentity } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { applyBalance } from "../orders/balance";
import { serializeUser } from "../orders/orders.serializer";
import { passwordPolicyError } from "../security/password";

const managedUserInclude = {
  identities: { where: { provider: "telegram" } },
  group: { select: { id: true, name: true } },
  servicePrices: { select: { serviceId: true, price: true } },
} satisfies Prisma.UserInclude;

function serializeManagedUser(
  user: User & {
    identities: UserIdentity[];
    group: { id: string; name: string } | null;
    servicePrices: { serviceId: string; price: number }[];
  },
) {
  const telegram = user.identities[0];
  return {
    ...serializeUser(user),
    telegramLinked: telegram
      ? {
          label: telegram.label ?? `ID ${telegram.externalId}`,
          chatReady: Boolean(telegram.chatId),
        }
      : null,
    groupId: user.groupId,
    groupName: user.group?.name ?? null,
    customPrices: user.servicePrices,
  };
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q?: string) {
    const needle = String(q ?? "").trim();
    const users = await this.prisma.user.findMany({
      where: needle
        ? {
            OR: [
              { username: { contains: needle, mode: "insensitive" } },
              { fullName: { contains: needle, mode: "insensitive" } },
              { telegramHandle: { contains: needle, mode: "insensitive" } },
              {
                identities: {
                  some: {
                    provider: "telegram",
                    label: { contains: needle, mode: "insensitive" },
                  },
                },
              },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      include: managedUserInclude,
    });
    return users.map(serializeManagedUser);
  }

  async create(input: {
    username?: string;
    fullName?: string;
    password?: string;
    telegramHandle?: string | null;
    groupId?: string | null;
    role?: "customer" | "testing";
    botAccess?: boolean;
    apiEnabled?: boolean;
  }) {
    const username = String(input.username ?? "")
      .trim()
      .toLowerCase();
    const fullName = String(input.fullName ?? "").trim() || username;
    const password = String(input.password ?? "");
    if (!username) {
      throw new BadRequestException("Username wajib diisi.");
    }
    const policyError = passwordPolicyError(password);
    if (policyError) throw new BadRequestException(policyError);
    const exists = await this.prisma.user.findUnique({ where: { username } });
    if (exists) throw new ConflictException("Username sudah dipakai.");
    await this.assertGroupExists(input.groupId);

    const user = await this.prisma.user.create({
      data: {
        username,
        fullName,
        passwordHash: await bcrypt.hash(password, 10),
        telegramHandle: input.telegramHandle?.trim() || null,
        botAccess: input.botAccess !== false,
        apiEnabled: input.apiEnabled === true,
        status: "active",
        groupId: input.groupId || null,
        role: input.role ?? "customer",
      },
      include: managedUserInclude,
    });
    return serializeManagedUser(user);
  }

  async update(
    id: string,
    input: {
      fullName?: string;
      telegramHandle?: string | null;
      groupId?: string | null;
      role?: "customer" | "testing";
      status?: "active" | "suspended";
      botAccess?: boolean;
      apiEnabled?: boolean;
      password?: string;
    },
  ) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("User tidak ditemukan.");

    const password = input.password ? String(input.password) : "";
    const policyError = password ? passwordPolicyError(password) : null;
    if (policyError) throw new BadRequestException(policyError);
    await this.assertGroupExists(input.groupId);
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(input.fullName != null
          ? { fullName: String(input.fullName).trim() }
          : {}),
        ...(input.telegramHandle !== undefined
          ? { telegramHandle: input.telegramHandle?.trim() || null }
          : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.role ? { role: input.role } : {}),
        ...(typeof input.botAccess === "boolean"
          ? { botAccess: input.botAccess }
          : {}),
        ...(typeof input.apiEnabled === "boolean"
          ? { apiEnabled: input.apiEnabled }
          : {}),
        ...(passwordHash ? { passwordHash } : {}),
        ...(input.groupId !== undefined ? { groupId: input.groupId || null } : {}),
      },
      include: managedUserInclude,
    });

    if (input.status === "suspended" || password) {
      await this.prisma.userSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return {
      user: serializeManagedUser(user),
      apiAccessChanged:
        typeof input.apiEnabled === "boolean" &&
        input.apiEnabled !== existing.apiEnabled,
    };
  }

  /**
   * Sets or clears the user's own prices. A price equal to what the user would pay anyway
   * (group price or default) is not stored, so exceptions never duplicate the group.
   */
  async updatePrices(
    id: string,
    input: { set: { serviceId: string; price: number }[]; remove: string[] },
  ) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("User tidak ditemukan.");
    const ids = input.set.map((p) => p.serviceId);
    const services = await this.prisma.service.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        price: true,
        groupPrices: {
          where: { groupId: existing.groupId ?? "" },
          select: { price: true },
        },
      },
    });
    if (services.length !== new Set(ids).size) {
      throw new BadRequestException("Layanan tidak ditemukan.");
    }
    const basePrice = new Map(
      services.map((s) => [s.id, s.groupPrices[0]?.price ?? s.price]),
    );
    const save = input.set.filter((p) => p.price !== basePrice.get(p.serviceId));
    const touched = [...new Set([...input.remove, ...ids])];

    const user = await this.prisma.$transaction(async (tx) => {
      if (touched.length) {
        await tx.userServicePrice.deleteMany({
          where: { userId: id, serviceId: { in: touched } },
        });
      }
      if (save.length) {
        await tx.userServicePrice.createMany({
          data: save.map((p) => ({ ...p, userId: id })),
        });
      }
      return tx.user.findUniqueOrThrow({ where: { id }, include: managedUserInclude });
    });
    return {
      user: serializeManagedUser(user),
      saved: save.length,
      removed: input.remove.length + input.set.length - save.length,
    };
  }

  /** Super Admin top-up (positive) or deduction (negative); a deduction cannot go below zero. */
  async adjustBalance(
    adminId: string,
    id: string,
    input: { amount: number; note: string },
  ) {
    const note = input.note.trim();
    if (!note) throw new BadRequestException("Catatan wajib diisi.");
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("User tidak ditemukan.");

    const user = await this.prisma.$transaction(async (tx) => {
      await applyBalance(tx, {
        userId: id,
        amount: input.amount,
        reason: "admin_adjust",
        refKey: `admin:${adminId}:${randomUUID()}`,
        note,
      });
      return tx.user.findUniqueOrThrow({
        where: { id },
        include: managedUserInclude,
      });
    });
    return serializeManagedUser(user);
  }

  async remove(id: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });
    if (!existing) throw new NotFoundException("User tidak ditemukan.");
    if (existing._count.orders > 0) {
      const user = await this.prisma.user.update({
        where: { id },
        data: { status: "suspended" },
      });
      await this.prisma.userSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return {
        deleted: false,
        suspended: true,
        user: serializeUser(user),
        message:
          "User punya riwayat order — status diubah ke suspended, bukan dihapus.",
      };
    }
    await this.prisma.user.delete({ where: { id } });
    return { deleted: true, suspended: false };
  }

  private async assertGroupExists(groupId?: string | null) {
    if (!groupId) return;
    const group = await this.prisma.userGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new BadRequestException("Group tidak ditemukan.");
  }
}
