import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../security/audit-log.service";
import { AdminNotifyService } from "./admin-notify.service";
import { AdminTelegramLinkService } from "./admin-telegram-link.service";
import { telegramBotUsername } from "./telegram-oauth.config";
import {
  inviteApprovalRequestHtml,
  inviteApprovedOperatorHtml,
  inviteRejectedOperatorHtml,
  operatorUnlinkedHtml,
} from "./telegram-messages";

export const INVITE_PREFIX = "inv_";
const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
const INVITE_TOKEN_RE = /^inv_[A-Za-z0-9_-]{32}$/;
const OPEN_STATUSES = ["pending", "claimed"] as const;

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class AdminTelegramInviteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: AdminNotifyService,
    private readonly links: AdminTelegramLinkService,
    private readonly audit: AuditLogService,
  ) {}

  async create(actorId: string, adminId: string) {
    const admin = await this.prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) throw new NotFoundException("Admin tidak ditemukan.");
    if (admin.role !== "admin") {
      throw new BadRequestException(
        "Undangan Telegram hanya untuk akun operator.",
      );
    }
    if (admin.status !== "active") {
      throw new BadRequestException("Aktifkan akun operator terlebih dahulu.");
    }
    if (admin.telegramChatId) {
      throw new ConflictException(
        "Operator sudah tertaut. Putuskan tautan dulu untuk mengganti akun Telegram.",
      );
    }

    const botUsername = telegramBotUsername();
    if (!botUsername || !process.env.TELEGRAM_BOT_TOKEN?.trim()) {
      throw new ServiceUnavailableException("Bot Telegram belum dikonfigurasi.");
    }

    const token = `${INVITE_PREFIX}${randomBytes(24).toString("base64url")}`;
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    await this.prisma.$transaction([
      this.prisma.adminTelegramInvite.updateMany({
        where: { adminId, status: { in: [...OPEN_STATUSES] } },
        data: { status: "revoked", decidedById: actorId, decidedAt: new Date() },
      }),
      this.prisma.adminTelegramInvite.create({
        data: {
          adminId,
          tokenHash: tokenHash(token),
          createdById: actorId,
          expiresAt,
        },
      }),
    ]);
    this.audit.record("admin.telegram.invite_created", { actorId, adminId });

    return {
      botUrl: `https://t.me/${botUsername}?start=${token}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async revoke(actorId: string, adminId: string) {
    const result = await this.prisma.adminTelegramInvite.updateMany({
      where: { adminId, status: { in: [...OPEN_STATUSES] } },
      data: { status: "revoked", decidedById: actorId, decidedAt: new Date() },
    });
    if (result.count > 0) {
      this.audit.record("admin.telegram.invite_revoked", { actorId, adminId });
    }
    return { ok: true };
  }

  /** Called by the bot when someone opens `/start inv_…` in a private chat. */
  async claim(input: {
    token: string;
    telegramUserId: string;
    chatId: string;
    username?: string;
    name?: string;
  }) {
    if (!INVITE_TOKEN_RE.test(input.token)) {
      throw new BadRequestException("Link undangan tidak valid.");
    }
    if (!input.telegramUserId || input.telegramUserId !== input.chatId) {
      throw new BadRequestException(
        "Buka link undangan dari chat pribadi dengan bot.",
      );
    }

    const invite = await this.prisma.adminTelegramInvite.findUnique({
      where: { tokenHash: tokenHash(input.token) },
      include: { admin: true },
    });
    if (
      !invite ||
      invite.status !== "pending" ||
      invite.expiresAt <= new Date()
    ) {
      throw new NotFoundException(
        "Link undangan tidak valid, sudah dipakai, atau kedaluwarsa.",
      );
    }
    if (
      invite.admin.role !== "admin" ||
      invite.admin.status !== "active" ||
      invite.admin.telegramChatId
    ) {
      throw new ConflictException("Akun operator ini tidak dapat ditautkan.");
    }
    await this.assertTelegramFree(
      this.prisma,
      invite.adminId,
      input.telegramUserId,
      input.chatId,
    );

    const claimed = await this.prisma.adminTelegramInvite.updateMany({
      where: { id: invite.id, status: "pending", expiresAt: { gt: new Date() } },
      data: {
        status: "claimed",
        claimTelegramUserId: input.telegramUserId,
        claimChatId: input.chatId,
        claimUsername: input.username?.slice(0, 64) ?? null,
        claimName: input.name?.slice(0, 128) ?? null,
        claimedAt: new Date(),
      },
    });
    if (claimed.count !== 1) {
      throw new NotFoundException(
        "Link undangan tidak valid, sudah dipakai, atau kedaluwarsa.",
      );
    }
    this.audit.record("admin.telegram.invite_claimed", {
      adminId: invite.adminId,
      telegramUserId: input.telegramUserId,
    });

    const html = inviteApprovalRequestHtml({
      adminUsername: invite.admin.username,
      adminFullName: invite.admin.fullName,
      telegramUserId: input.telegramUserId,
      telegramUsername: input.username,
      telegramName: input.name,
    });
    const keyboard = [
      [
        { text: "✅ Setujui", callback_data: `inv:ok:${invite.id}` },
        { text: "🚫 Tolak", callback_data: `inv:no:${invite.id}` },
      ],
    ];
    const superAdmins = (await this.links.notificationDestinations()).filter(
      (d) => d.role === "super_admin",
    );
    for (const dest of superAdmins) {
      await this.notify.sendHtml(dest.chatId, html, keyboard);
    }

    return { fullName: invite.admin.fullName };
  }

  async approveForAdmin(actorId: string, adminId: string) {
    return this.decide(actorId, await this.openClaimId(adminId), true);
  }

  async rejectForAdmin(actorId: string, adminId: string) {
    return this.decide(actorId, await this.openClaimId(adminId), false);
  }

  async decide(actorId: string, inviteId: string, approve: boolean) {
    const decider = await this.prisma.admin.findUnique({
      where: { id: actorId },
      select: { role: true, status: true, username: true },
    });
    if (!decider || decider.role !== "super_admin" || decider.status !== "active") {
      throw new ForbiddenException("Hanya Super Admin yang dapat memutuskan.");
    }

    const result = await this.prisma
      .$transaction(async (tx) => {
        const invite = await tx.adminTelegramInvite.findUnique({
          where: { id: inviteId },
          include: { admin: true },
        });
        if (!invite || invite.status !== "claimed") {
          throw new ConflictException("Permintaan ini sudah diputuskan.");
        }
        const claimed = await tx.adminTelegramInvite.updateMany({
          where: { id: invite.id, status: "claimed" },
          data: {
            status: approve ? "approved" : "rejected",
            decidedById: actorId,
            decidedAt: new Date(),
          },
        });
        if (claimed.count !== 1) {
          throw new ConflictException("Permintaan ini sudah diputuskan.");
        }
        if (!approve) return invite;

        const telegramUserId = invite.claimTelegramUserId ?? "";
        const chatId = invite.claimChatId ?? "";
        if (
          !telegramUserId ||
          !chatId ||
          invite.admin.role !== "admin" ||
          invite.admin.status !== "active" ||
          invite.admin.telegramChatId
        ) {
          throw new ConflictException("Akun operator ini tidak dapat ditautkan.");
        }
        await this.assertTelegramFree(tx, invite.adminId, telegramUserId, chatId);
        const now = new Date();
        await tx.admin.update({
          where: { id: invite.adminId },
          data: {
            telegramUserId,
            telegramChatId: chatId,
            telegramUsername: invite.claimUsername
              ? `@${invite.claimUsername}`
              : null,
            telegramOauthLinkedAt: now,
            telegramLinkedAt: now,
          },
        });
        return invite;
      })
      .catch((err: unknown) => {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          throw new ConflictException(
            "Akun Telegram sudah tertaut ke akun ZITTOSITE lain.",
          );
        }
        throw err;
      });

    this.audit.record(
      approve
        ? "admin.telegram.invite_approved"
        : "admin.telegram.invite_rejected",
      { actorId, adminId: result.adminId },
    );
    if (result.claimChatId) {
      await this.notify.sendHtml(
        result.claimChatId,
        approve
          ? inviteApprovedOperatorHtml(result.admin.fullName)
          : inviteRejectedOperatorHtml(),
      );
    }
    return {
      approved: approve,
      adminUsername: result.admin.username,
      deciderUsername: decider.username,
    };
  }

  async unlink(actorId: string, adminId: string) {
    const admin = await this.prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) throw new NotFoundException("Admin tidak ditemukan.");
    if (admin.role !== "admin") {
      throw new BadRequestException(
        "Super Admin memutuskan Telegram sendiri dari halaman Security.",
      );
    }
    const previousChatId = admin.telegramChatId;
    await this.prisma.$transaction([
      this.prisma.admin.update({
        where: { id: adminId },
        data: {
          telegramUserId: null,
          telegramChatId: null,
          telegramUsername: null,
          telegramOauthLinkedAt: null,
          telegramLinkedAt: null,
        },
      }),
      this.prisma.adminTelegramInvite.updateMany({
        where: { adminId, status: { in: [...OPEN_STATUSES] } },
        data: { status: "revoked", decidedById: actorId, decidedAt: new Date() },
      }),
    ]);
    this.audit.record("admin.telegram.unlinked", { actorId, adminId });
    if (previousChatId) {
      await this.notify.sendHtml(previousChatId, operatorUnlinkedHtml());
    }
    return { ok: true };
  }

  private async openClaimId(adminId: string) {
    const invite = await this.prisma.adminTelegramInvite.findFirst({
      where: { adminId, status: "claimed" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!invite) {
      throw new NotFoundException("Tidak ada permintaan tautan yang menunggu.");
    }
    return invite.id;
  }

  private async assertTelegramFree(
    db: Prisma.TransactionClient | PrismaService,
    adminId: string,
    telegramUserId: string,
    chatId: string,
  ) {
    const [adminOwner, userOwner] = await Promise.all([
      db.admin.findFirst({
        where: {
          id: { not: adminId },
          OR: [{ telegramUserId }, { telegramChatId: chatId }],
        },
        select: { id: true },
      }),
      db.userIdentity.findFirst({
        where: {
          provider: "telegram",
          OR: [{ externalId: telegramUserId }, { chatId }],
        },
        select: { id: true },
      }),
    ]);
    if (adminOwner || userOwner) {
      throw new ConflictException(
        "Akun Telegram ini sudah tertaut ke akun ZITTOSITE lain.",
      );
    }
  }
}
