CREATE TYPE "AdminInviteStatus" AS ENUM ('pending', 'claimed', 'approved', 'rejected', 'revoked');

CREATE TABLE "admin_telegram_invites" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" "AdminInviteStatus" NOT NULL DEFAULT 'pending',
    "created_by_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "claim_telegram_user_id" TEXT,
    "claim_chat_id" TEXT,
    "claim_username" TEXT,
    "claim_name" TEXT,
    "claimed_at" TIMESTAMP(3),
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_telegram_invites_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "admin_telegram_invites_token_hash_key" ON "admin_telegram_invites"("token_hash");
CREATE INDEX "admin_telegram_invites_admin_id_status_idx" ON "admin_telegram_invites"("admin_id", "status");
ALTER TABLE "admin_telegram_invites" ADD CONSTRAINT "admin_telegram_invites_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
