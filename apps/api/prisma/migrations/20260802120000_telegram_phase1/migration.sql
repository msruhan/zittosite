-- AlterTable
ALTER TABLE "users" ADD COLUMN "credit_balance" INTEGER NOT NULL DEFAULT 0;

-- CreateEnum
CREATE TYPE "ChannelProvider" AS ENUM ('telegram');

-- CreateEnum
CREATE TYPE "TelegramActorType" AS ENUM ('user', 'admin');

-- AlterTable
ALTER TABLE "admins" ADD COLUMN "telegram_user_id" TEXT,
ADD COLUMN "telegram_chat_id" TEXT,
ADD COLUMN "telegram_username" TEXT,
ADD COLUMN "telegram_oauth_linked_at" TIMESTAMP(3),
ADD COLUMN "telegram_linked_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "admins_telegram_user_id_key" ON "admins"("telegram_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "admins_telegram_chat_id_key" ON "admins"("telegram_chat_id");

-- CreateTable
CREATE TABLE "user_identities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "ChannelProvider" NOT NULL,
    "external_id" TEXT NOT NULL,
    "chat_id" TEXT,
    "label" TEXT,
    "verified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chat_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_identities_provider_external_id_key" ON "user_identities"("provider", "external_id");
CREATE UNIQUE INDEX "user_identities_provider_chat_id_key" ON "user_identities"("provider", "chat_id");
CREATE UNIQUE INDEX "user_identities_user_id_provider_key" ON "user_identities"("user_id", "provider");
CREATE INDEX "user_identities_user_id_idx" ON "user_identities"("user_id");

ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "telegram_link_tokens" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "actor_type" "TelegramActorType" NOT NULL,
    "user_id" TEXT,
    "admin_id" TEXT,
    "telegram_user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telegram_link_tokens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "telegram_link_tokens_token_hash_idx" ON "telegram_link_tokens"("token_hash");
CREATE INDEX "telegram_link_tokens_user_id_idx" ON "telegram_link_tokens"("user_id");
CREATE INDEX "telegram_link_tokens_admin_id_idx" ON "telegram_link_tokens"("admin_id");

ALTER TABLE "telegram_link_tokens" ADD CONSTRAINT "telegram_link_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "telegram_link_tokens" ADD CONSTRAINT "telegram_link_tokens_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
