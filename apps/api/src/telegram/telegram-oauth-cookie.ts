import { BadRequestException } from "@nestjs/common";
import type { CookieOptions } from "express";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { TelegramActorType } from "@prisma/client";
import {
  getAdminJwtSecret,
  getUserJwtSecret,
  isProduction,
} from "../config/env";

type OauthStatePayload = {
  actorType: TelegramActorType;
  actorId: string;
  state: string;
  verifier: string;
  expiresAt: number;
};

function signingSecret(actorType: TelegramActorType): string {
  return actorType === "admin" ? getAdminJwtSecret() : getUserJwtSecret();
}

export function oauthCookieName(actorType: TelegramActorType): string {
  return actorType === "admin"
    ? "zittosite_tg_oauth_admin"
    : "zittosite_tg_oauth_user";
}

export function oauthCookieOptions(actorType: TelegramActorType): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path:
      actorType === "admin"
        ? "/admin/settings/telegram/oauth"
        : "/me/telegram/oauth",
    maxAge: 5 * 60 * 1000,
  };
}

function sign(payload: string, actorType: TelegramActorType): string {
  return createHmac("sha256", signingSecret(actorType))
    .update(payload)
    .digest("base64url");
}

function encode(payload: OauthStatePayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, payload.actorType)}`;
}

function decode(value: string, actorType: TelegramActorType): OauthStatePayload {
  const [body, signature, extra] = String(value ?? "").split(".");
  if (!body || !signature || extra) {
    throw new BadRequestException("Sesi OAuth Telegram tidak valid.");
  }
  const expected = Buffer.from(sign(body, actorType));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new BadRequestException("Sesi OAuth Telegram tidak valid.");
  }
  try {
    return JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as OauthStatePayload;
  } catch {
    throw new BadRequestException("Sesi OAuth Telegram tidak valid.");
  }
}

export function createTelegramOauthState(
  actorType: TelegramActorType,
  actorId: string,
) {
  const nonce = randomBytes(24).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const state = `${actorType === "admin" ? "a" : "u"}_${nonce}`;
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const payload: OauthStatePayload = {
    actorType,
    actorId,
    state,
    verifier,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };
  return {
    state,
    verifier,
    challenge,
    cookieName: oauthCookieName(actorType),
    cookieValue: encode(payload),
    cookieOptions: oauthCookieOptions(actorType),
  };
}

export function consumeTelegramOauthState(input: {
  actorType: TelegramActorType;
  actorId: string;
  state: string;
  cookieValue?: string;
}): OauthStatePayload {
  if (!input.cookieValue) {
    throw new BadRequestException("Sesi OAuth Telegram telah berakhir.");
  }
  const payload = decode(input.cookieValue, input.actorType);
  if (
    payload.actorType !== input.actorType ||
    payload.actorId !== input.actorId ||
    payload.state !== input.state ||
    payload.expiresAt <= Date.now()
  ) {
    throw new BadRequestException(
      "Sesi OAuth Telegram tidak cocok atau sudah kedaluwarsa.",
    );
  }
  return payload;
}
