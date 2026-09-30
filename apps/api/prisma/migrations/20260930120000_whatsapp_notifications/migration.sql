-- CreateEnum
CREATE TYPE "WhatsappNotificationStatus" AS ENUM ('pending', 'sending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "whatsapp_notifications" (
    "id" TEXT NOT NULL,
    "invoice_row_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "WhatsappNotificationStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "waha_message_id" TEXT,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_notifications_invoice_row_id_key" ON "whatsapp_notifications"("invoice_row_id");

-- CreateIndex
CREATE INDEX "whatsapp_notifications_status_next_attempt_at_idx" ON "whatsapp_notifications"("status", "next_attempt_at");

-- AddForeignKey
ALTER TABLE "whatsapp_notifications" ADD CONSTRAINT "whatsapp_notifications_invoice_row_id_fkey" FOREIGN KEY ("invoice_row_id") REFERENCES "payment_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

