import { ServiceUnavailableException } from "@nestjs/common";
import { webPublicUrl } from "../config/env";

export const TELEGRAM_OAUTH_ISSUER = "https://oauth.telegram.org";
export const TELEGRAM_OAUTH_AUTHORIZE_URL = `${TELEGRAM_OAUTH_ISSUER}/auth`;
export const TELEGRAM_OAUTH_TOKEN_URL = `${TELEGRAM_OAUTH_ISSUER}/token`;
export const TELEGRAM_OAUTH_JWKS_URL = `${TELEGRAM_OAUTH_ISSUER}/.well-known/jwks.json`;

export type TelegramOauthConfig = {
  clientId: string;
  clientSecret: string;
  botUsername: string;
  redirectUri: string;
};

export function telegramBotUsername(): string {
  return (process.env.TELEGRAM_BOT_USERNAME ?? "").trim().replace(/^@/, "");
}

export function telegramOauthConfig(): TelegramOauthConfig {
  const clientId = process.env.TELEGRAM_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.TELEGRAM_OAUTH_CLIENT_SECRET?.trim();
  const botUsername = telegramBotUsername();
  const redirectUri =
    process.env.TELEGRAM_OAUTH_REDIRECT_URI?.trim() ||
    `${webPublicUrl()}/auth/telegram/callback`;

  if (!clientId || !/^\d+$/.test(clientId) || !clientSecret || !botUsername) {
    throw new ServiceUnavailableException(
      "Telegram OAuth belum dikonfigurasi.",
    );
  }
  return { clientId, clientSecret, botUsername, redirectUri };
}
