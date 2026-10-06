-- AlterEnum
ALTER TYPE "FulfillmentChannel" ADD VALUE 'whatsapp_admin';

-- AlterTable
ALTER TABLE "admins" ADD COLUMN "whatsapp_number" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "admins_whatsapp_number_key" ON "admins"("whatsapp_number");

-- CreateTable
CREATE TABLE "order_whatsapp_messages" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "WhatsappNotificationStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "waha_message_id" TEXT,
    "message_key" TEXT,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_whatsapp_messages_order_id_key" ON "order_whatsapp_messages"("order_id");

-- CreateIndex
CREATE INDEX "order_whatsapp_messages_status_next_attempt_at_idx" ON "order_whatsapp_messages"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "order_whatsapp_messages_message_key_idx" ON "order_whatsapp_messages"("message_key");

-- AddForeignKey
ALTER TABLE "order_whatsapp_messages" ADD CONSTRAINT "order_whatsapp_messages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
