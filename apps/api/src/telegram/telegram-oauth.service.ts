import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { TelegramActorType } from "@prisma/client";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { PrismaService } from "../prisma/prisma.service";
import {
  consumeTelegramOauthState,
  createTelegramOauthState,
} from "./telegram-oauth-cookie";
import {
  TELEGRAM_OAUTH_AUTHORIZE_URL,
  TELEGRAM_OAUTH_ISSUER,
  TELEGRAM_OAUTH_JWKS_URL,
  TELEGRAM_OAUTH_TOKEN_URL,
  telegramOauthConfig,
} from "./telegram-oauth.config";
import { TelegramLinkTokenService } from "./telegram-link-token.service";

type TelegramProfile = {
  id: string;
  username?: string;
  label: string;
};

@Injectable()
export class TelegramOauthService {
  private readonly jwks = createRemoteJWKSet(new URL(TELEGRAM_OAUTH_JWKS_URL));

  constructor(
    private readonly prisma: PrismaService,
    private readonly linkTokens: TelegramLinkTokenService,
  ) {}

  async start(actorType: TelegramActorType, actorId: string) {
    const config = telegramOauthConfig();
    await this.assertActorMayLink(actorType, actorId);
    const oauth = createTelegramOauthState(actorType, actorId);
    const url = new URL(TELEGRAM_OAUTH_AUTHORIZE_URL);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid profile");
    url.searchParams.set("state", oauth.state);
    url.searchParams.set("code_challenge", oauth.challenge);
    url.searchParams.set("code_challenge_method", "S256");
    return {
      authorizationUrl: url.toString(),
      cookie: oauth,
    };
  }

  async complete(input: {
    actorType: TelegramActorType;
    actorId: string;
    code: string;
    state: string;
    cookieValue?: string;
  }) {
    const code = String(input.code ?? "").trim();
    const state = String(input.state ?? "").trim();
    if (!code || !state) {
      throw new BadRequestException("Kode atau state OAuth Telegram hilang.");
    }
    const oauth = consumeTelegramOauthState({
      actorType: input.actorType,
      actorId: input.actorId,
      state,
      cookieValue: input.cookieValue,
    });
    await this.assertActorMayLink(input.actorType, input.actorId);
    const profile = await this.exchangeAndVerify(code, oauth.verifier);
    await this.storeIdentity(input.actorType, input.actorId, profile);
    return this.linkTokens.issue({
      actorType: input.actorType,
      actorId: input.actorId,
      telegramUserId: profile.id,
    });
  }

  async userStatus(userId: string) {
    const identity = await this.prisma.userIdentity.findUnique({
      where: { userId_provider: { userId, provider: "telegram" } },
    });
    return {
      oauthLinked: Boolean(identity),
      chatLinked: Boolean(identity?.chatId && identity.chatVerifiedAt),
      username: identity?.label ?? null,
      oauthLinkedAt: identity?.verifiedAt ?? null,
      linkedAt: identity?.chatVerifiedAt ?? null,
    };
  }

  async adminStatus(adminId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        telegramUserId: true,
        telegramChatId: true,
        telegramUsername: true,
        telegramOauthLinkedAt: true,
        telegramLinkedAt: true,
      },
    });
    if (!admin) throw new NotFoundException("Admin tidak ditemukan.");
    return {
      oauthLinked: Boolean(admin.telegramUserId),
      chatLinked: Boolean(admin.telegramChatId && admin.telegramLinkedAt),
      username: admin.telegramUsername,
      oauthLinkedAt: admin.telegramOauthLinkedAt,
      linkedAt: admin.telegramLinkedAt,
    };
  }

  async unlinkUser(userId: string) {
    await this.prisma.$transaction(async (tx) => {
      const identity = await tx.userIdentity.findUnique({
        where: { userId_provider: { userId, provider: "telegram" } },
      });
      await tx.telegramLinkToken.deleteMany({
        where: { actorType: "user", userId },
      });
      if (identity) await tx.userIdentity.delete({ where: { id: identity.id } });
    });
    return { linked: false };
  }

  async unlinkAdmin(adminId: string) {
    await this.prisma.$transaction(async (tx) => {
      const admin = await tx.admin.findUnique({ where: { id: adminId } });
      if (!admin) throw new NotFoundException("Admin tidak ditemukan.");
      await tx.telegramLinkToken.deleteMany({
        where: { actorType: "admin", adminId },
      });
      await tx.admin.update({
        where: { id: adminId },
        data: {
          telegramUserId: null,
          telegramChatId: null,
          telegramUsername: null,
          telegramOauthLinkedAt: null,
          telegramLinkedAt: null,
        },
      });
    });
    return { linked: false };
  }

  private async assertActorMayLink(
    actorType: TelegramActorType,
    actorId: string,
  ) {
    if (actorType === "user") {
      const user = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: {
          status: true,
          botAccess: true,
          identities: {
            where: { provider: "telegram" },
            select: { chatId: true, chatVerifiedAt: true },
          },
        },
      });
      if (!user) throw new NotFoundException("User tidak ditemukan.");
      if (user.status !== "active") {
        throw new ForbiddenException("Akun tidak aktif.");
      }
      if (!user.botAccess) {
        throw new ForbiddenException("Akses bot dinonaktifkan untuk akun ini.");
      }
      if (
        user.identities.some(
          (identity) => identity.chatId && identity.chatVerifiedAt,
        )
      ) {
        throw new ConflictException(
          "Lepas tautan Telegram yang ada terlebih dahulu.",
        );
      }
      return;
    }
    const admin = await this.prisma.admin.findUnique({
      where: { id: actorId },
      select: {
        status: true,
        totpEnabledAt: true,
        telegramChatId: true,
        telegramLinkedAt: true,
      },
    });
    if (!admin) throw new NotFoundException("Admin tidak ditemukan.");
    if (admin.status !== "active") {
      throw new ForbiddenException("Akun Admin tidak aktif.");
    }
    if (!admin.totpEnabledAt) {
      throw new ForbiddenException(
        "Aktifkan Google Authenticator sebelum menautkan Telegram.",
      );
    }
    if (admin.telegramChatId && admin.telegramLinkedAt) {
      throw new ConflictException(
        "Lepas tautan Telegram yang ada terlebih dahulu.",
      );
    }
  }

  private async exchangeAndVerify(
    code: string,
    verifier: string,
  ): Promise<TelegramProfile> {
    const config = telegramOauthConfig();
    let response: Response;
    try {
      response = await fetch(TELEGRAM_OAUTH_TOKEN_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${config.clientId}:${config.clientSecret}`,
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: config.clientId,
          redirect_uri: config.redirectUri,
          code_verifier: verifier,
        }),
      });
    } catch {
      throw new BadGatewayException("Telegram OAuth tidak dapat dijangkau.");
    }
    if (!response.ok) {
      throw new BadGatewayException("Telegram menolak permintaan OAuth.");
    }
    let tokens: { id_token?: string };
    try {
      tokens = (await response.json()) as { id_token?: string };
    } catch {
      throw new BadGatewayException(
        "Telegram mengembalikan respons OAuth tidak valid.",
      );
    }
    if (!tokens.id_token) {
      throw new BadGatewayException("Telegram tidak mengembalikan identitas.");
    }

    let payload;
    try {
      ({ payload } = await jwtVerify(tokens.id_token, this.jwks, {
        issuer: TELEGRAM_OAUTH_ISSUER,
      }));
    } catch {
      throw new BadRequestException("Identitas Telegram tidak valid.");
    }
    const audiences = Array.isArray(payload.aud)
      ? payload.aud.map((value: string | number) => String(value))
      : [String(payload.aud ?? "")];
    if (!audiences.includes(config.clientId)) {
      throw new BadRequestException("Identitas Telegram tidak valid.");
    }
    const id =
      String(payload.id ?? "").trim() || String(payload.sub ?? "").trim();
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException("Identitas Telegram tidak valid.");
    }
    const username =
      typeof payload.preferred_username === "string"
        ? payload.preferred_username.replace(/^@/, "").trim()
        : undefined;
    const givenName =
      typeof payload.given_name === "string" ? payload.given_name.trim() : "";
    const familyName =
      typeof payload.family_name === "string" ? payload.family_name.trim() : "";
    const label =
      username
        ? `@${username}`
        : [givenName, familyName].filter(Boolean).join(" ") || id;
    return { id, username, label };
  }

  private async storeIdentity(
    actorType: TelegramActorType,
    actorId: string,
    profile: TelegramProfile,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`telegram-user:${profile.id}`}))`;
      const [userOwner, adminOwner] = await Promise.all([
        tx.userIdentity.findUnique({
          where: {
            provider_externalId: {
              provider: "telegram",
              externalId: profile.id,
            },
          },
          select: { userId: true },
        }),
        tx.admin.findUnique({
          where: { telegramUserId: profile.id },
          select: { id: true },
        }),
      ]);
      if (
        (userOwner && (actorType !== "user" || userOwner.userId !== actorId)) ||
        (adminOwner && (actorType !== "admin" || adminOwner.id !== actorId))
      ) {
        throw new ConflictException(
          "Akun Telegram ini sudah tertaut ke akun ZITTOSITE lain.",
        );
      }

      if (actorType === "user") {
        const current = await tx.userIdentity.findUnique({
          where: {
            userId_provider: { userId: actorId, provider: "telegram" },
          },
        });
        if (current && current.externalId !== profile.id) {
          throw new ConflictException(
            "Lepas tautan Telegram yang ada terlebih dahulu.",
          );
        }
        await tx.userIdentity.upsert({
          where: {
            userId_provider: { userId: actorId, provider: "telegram" },
          },
          create: {
            userId: actorId,
            provider: "telegram",
            externalId: profile.id,
            label: profile.label,
          },
          update: {
            label: profile.label,
            verifiedAt: new Date(),
            chatId: null,
            chatVerifiedAt: null,
          },
        });
        return;
      }

      const admin = await tx.admin.findUnique({ where: { id: actorId } });
      if (!admin) throw new NotFoundException("Admin tidak ditemukan.");
      if (admin.telegramUserId && admin.telegramUserId !== profile.id) {
        throw new ConflictException(
          "Lepas tautan Telegram yang ada terlebih dahulu.",
        );
      }
      await tx.admin.update({
        where: { id: actorId },
        data: {
          telegramUserId: profile.id,
          telegramUsername: profile.label,
          telegramOauthLinkedAt: new Date(),
          telegramChatId: null,
          telegramLinkedAt: null,
        },
      });
    });
  }
}
