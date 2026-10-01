import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  Prisma,
  User,
  UserIdentity,
  UserServicePrice,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { applyBalance } from "../orders/balance";
import { serializeUser } from "../orders/orders.serializer";
import { passwordPolicyError } from "../security/password";
import type { ServicePriceInput } from "../security/input";

const managedUserInclude = {
  servicePrices: true,
  identities: { where: { provider: "telegram" } },
  group: { select: { id: true, name: true } },
} satisfies Prisma.UserInclude;

function serializeManagedUser(
  user: User & {
    servicePrices: UserServicePrice[];
    identities: UserIdentity[];
    group: { id: string; name: string } | null;
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
    customPrices: user.servicePrices.map(({ serviceId, price }) => ({
      serviceId,
      price,
    })),
    groupId: user.groupId,
    groupName: user.group?.name ?? null,
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
    customPrices?: ServicePriceInput[];
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
    await this.assertServicesExist(input.customPrices);
    await this.assertGroupExists(input.groupId);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
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
      });
      await this.replacePrices(
        tx,
        created.id,
        input.groupId ? [] : input.customPrices,
      );
      return tx.user.findUniqueOrThrow({
        where: { id: created.id },
        include: managedUserInclude,
      });
    });
    return serializeManagedUser(user);
  }

  async update(
    id: string,
    input: {
      fullName?: string;
      telegramHandle?: string | null;
      customPrices?: ServicePriceInput[];
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
    await this.assertServicesExist(input.customPrices);
    await this.assertGroupExists(input.groupId);
    const nextGroupId =
      input.groupId === undefined ? existing.groupId : input.groupId || null;
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
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
          ...(input.groupId !== undefined ? { groupId: nextGroupId } : {}),
        },
      });
      await this.replacePrices(tx, id, nextGroupId ? [] : input.customPrices);
      return tx.user.findUniqueOrThrow({
        where: { id },
        include: managedUserInclude,
      });
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

  private async assertServicesExist(prices?: ServicePriceInput[]) {
    if (!prices?.length) return;
    const found = await this.prisma.service.count({
      where: { id: { in: prices.map((p) => p.serviceId) } },
    });
    if (found !== prices.length) {
      throw new BadRequestException("Layanan pada harga khusus tidak ditemukan.");
    }
  }

  /** `undefined` leaves prices untouched; an array replaces the whole set. */
  private async replacePrices(
    tx: Prisma.TransactionClient,
    userId: string,
    prices?: ServicePriceInput[],
  ) {
    if (prices === undefined) return;
    await tx.userServicePrice.deleteMany({ where: { userId } });
    if (prices.length) {
      await tx.userServicePrice.createMany({
        data: prices.map(({ serviceId, price }) => ({
          userId,
          serviceId,
          price,
        })),
      });
    }
  }
}
