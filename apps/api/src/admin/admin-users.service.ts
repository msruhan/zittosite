import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma, User, UserServicePrice } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { serializeUser } from "../orders/orders.serializer";
import { passwordPolicyError } from "../security/password";
import type { ServicePriceInput } from "../security/input";

function serializeManagedUser(
  user: User & { servicePrices: UserServicePrice[] },
) {
  return {
    ...serializeUser(user),
    customPrices: user.servicePrices.map(({ serviceId, price }) => ({
      serviceId,
      price,
    })),
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
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      include: { servicePrices: true },
    });
    return users.map(serializeManagedUser);
  }

  async create(input: {
    username?: string;
    fullName?: string;
    password?: string;
    telegramHandle?: string | null;
    customPrices?: ServicePriceInput[];
    botAccess?: boolean;
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

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username,
          fullName,
          passwordHash: await bcrypt.hash(password, 10),
          telegramHandle: input.telegramHandle?.trim() || null,
          botAccess: input.botAccess !== false,
          status: "active",
        },
      });
      await this.replacePrices(tx, created.id, input.customPrices);
      return tx.user.findUniqueOrThrow({
        where: { id: created.id },
        include: { servicePrices: true },
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
      status?: "active" | "suspended";
      botAccess?: boolean;
      password?: string;
    },
  ) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("User tidak ditemukan.");

    const password = input.password ? String(input.password) : "";
    const policyError = password ? passwordPolicyError(password) : null;
    if (policyError) throw new BadRequestException(policyError);
    await this.assertServicesExist(input.customPrices);
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
          ...(typeof input.botAccess === "boolean"
            ? { botAccess: input.botAccess }
            : {}),
          ...(passwordHash ? { passwordHash } : {}),
        },
      });
      await this.replacePrices(tx, id, input.customPrices);
      return tx.user.findUniqueOrThrow({
        where: { id },
        include: { servicePrices: true },
      });
    });

    if (input.status === "suspended" || password) {
      await this.prisma.userSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

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
