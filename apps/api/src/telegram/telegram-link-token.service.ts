import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { TelegramActorType } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { telegramOauthConfig } from "./telegram-oauth.config";

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class TelegramLinkTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(input: {
    actorType: TelegramActorType;
    actorId: string;
    telegramUserId: string;
  }) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.prisma.$transaction(async (tx) => {
      await tx.telegramLinkToken.deleteMany({
        where:
          input.actorType === "user"
            ? { actorType: "user", userId: input.actorId, consumedAt: null }
            : { actorType: "admin", adminId: input.actorId, consumedAt: null },
      });
      await tx.telegramLinkToken.create({
        data: {
          tokenHash: tokenHash(token),
          actorType: input.actorType,
          userId: input.actorType === "user" ? input.actorId : null,
          adminId: input.actorType === "admin" ? input.actorId : null,
          telegramUserId: input.telegramUserId,
          expiresAt,
        },
      });
    });
    const { botUsername } = telegramOauthConfig();
    return {
      botUrl: `https://t.me/${botUsername}?start=${token}`,
      expiresAt,
    };
  }

  async consume(input: {
    token: string;
    telegramUserId: string;
    chatId: string;
    username?: string;
  }) {
    if (!/^[a-f0-9]{64}$/.test(input.token)) {
      throw new BadRequestException(
        "Tautan Telegram tidak valid atau sudah kedaluwarsa",
      );
    }
    if (input.telegramUserId !== input.chatId) {
      throw new BadRequestException(
        "Tautan hanya dapat digunakan melalui chat pribadi",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.telegramLinkToken.findFirst({
        where: {
          tokenHash: tokenHash(input.token),
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (!row || row.telegramUserId !== input.telegramUserId) {
        throw new NotFoundException(
          "Tautan Telegram tidak valid atau sudah kedaluwarsa",
        );
      }

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`telegram-chat:${input.chatId}`}))`;

      const [userChatOwner, adminChatOwner] = await Promise.all([
        tx.userIdentity.findFirst({
          where: { provider: "telegram", chatId: input.chatId },
          select: { userId: true },
        }),
        tx.admin.findFirst({
          where: { telegramChatId: input.chatId },
          select: { id: true },
        }),
      ]);
      const expectedUserId = row.actorType === "user" ? row.userId : null;
      const expectedAdminId = row.actorType === "admin" ? row.adminId : null;
      if (
        (userChatOwner && userChatOwner.userId !== expectedUserId) ||
        (adminChatOwner && adminChatOwner.id !== expectedAdminId)
      ) {
        throw new ConflictException(
          "Akun Telegram sudah tertaut ke akun ZITTOSITE lain",
        );
      }

      const claimed = await tx.telegramLinkToken.updateMany({
        where: {
          id: row.id,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new NotFoundException(
          "Tautan Telegram tidak valid atau sudah kedaluwarsa",
        );
      }

      if (row.actorType === "user" && row.userId) {
        const identity = await tx.userIdentity.findUnique({
          where: {
            userId_provider: { userId: row.userId, provider: "telegram" },
          },
        });
        if (!identity || identity.externalId !== input.telegramUserId) {
          throw new ConflictException("Identitas OAuth Telegram tidak cocok");
        }
        await tx.userIdentity.update({
          where: { id: identity.id },
          data: {
            chatId: input.chatId,
            chatVerifiedAt: new Date(),
            label: input.username ? `@${input.username}` : identity.label,
          },
        });
        return { actorType: row.actorType, actorId: row.userId };
      }

      if (row.actorType === "admin" && row.adminId) {
        const admin = await tx.admin.findUnique({ where: { id: row.adminId } });
        if (
          !admin ||
          admin.telegramUserId !== input.telegramUserId ||
          admin.status !== "active"
        ) {
          throw new ConflictException("Identitas OAuth Telegram tidak cocok");
        }
        await tx.admin.update({
          where: { id: row.adminId },
          data: {
            telegramChatId: input.chatId,
            telegramUsername: input.username
              ? `@${input.username}`
              : admin.telegramUsername,
            telegramLinkedAt: new Date(),
          },
        });
        return { actorType: row.actorType, actorId: row.adminId };
      }

      throw new ConflictException("Pemilik tautan Telegram tidak valid");
    });
  }
}
