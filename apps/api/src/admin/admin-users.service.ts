import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { serializeUser } from "../orders/orders.serializer";

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
    });
    return users.map(serializeUser);
  }

  async create(input: {
    username?: string;
    fullName?: string;
    password?: string;
    telegramHandle?: string | null;
    customPrice?: number | null;
    botAccess?: boolean;
  }) {
    const username = String(input.username ?? "")
      .trim()
      .toLowerCase();
    const fullName = String(input.fullName ?? "").trim();
    const password = String(input.password ?? "");
    if (!username || !fullName) {
      throw new BadRequestException("Username dan nama lengkap wajib.");
    }
    if (password.length < 8) {
      throw new BadRequestException("Password minimal 8 karakter.");
    }
    const exists = await this.prisma.user.findUnique({ where: { username } });
    if (exists) throw new ConflictException("Username sudah dipakai.");

    const user = await this.prisma.user.create({
      data: {
        username,
        fullName,
        passwordHash: await bcrypt.hash(password, 10),
        telegramHandle: input.telegramHandle?.trim() || null,
        customPrice:
          input.customPrice != null && Number.isFinite(input.customPrice)
            ? Number(input.customPrice)
            : null,
        botAccess: input.botAccess !== false,
        status: "active",
      },
    });
    return serializeUser(user);
  }

  async update(
    id: string,
    input: {
      fullName?: string;
      telegramHandle?: string | null;
      customPrice?: number | null;
      status?: "active" | "suspended";
      botAccess?: boolean;
      password?: string;
    },
  ) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("User tidak ditemukan.");

    const password = input.password ? String(input.password) : "";
    if (password && password.length < 8) {
      throw new BadRequestException("Password minimal 8 karakter.");
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(input.fullName != null
          ? { fullName: String(input.fullName).trim() }
          : {}),
        ...(input.telegramHandle !== undefined
          ? { telegramHandle: input.telegramHandle?.trim() || null }
          : {}),
        ...(input.customPrice !== undefined
          ? {
              customPrice:
                input.customPrice != null && Number.isFinite(input.customPrice)
                  ? Number(input.customPrice)
                  : null,
            }
          : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(typeof input.botAccess === "boolean"
          ? { botAccess: input.botAccess }
          : {}),
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      },
    });

    if (input.status === "suspended" || password) {
      await this.prisma.userSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return serializeUser(user);
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
}
