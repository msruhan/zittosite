CREATE TABLE "order_telegram_notifications" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "message_id" TEXT,
    "notified_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_telegram_notifications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "order_telegram_notifications_order_id_admin_id_key" ON "order_telegram_notifications"("order_id", "admin_id");
CREATE INDEX "order_telegram_notifications_order_id_idx" ON "order_telegram_notifications"("order_id");
ALTER TABLE "order_telegram_notifications" ADD CONSTRAINT "order_telegram_notifications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_telegram_notifications" ADD CONSTRAINT "order_telegram_notifications_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
