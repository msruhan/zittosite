-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('waiting_payment', 'paid', 'waiting_action', 'in_process', 'done', 'rejected', 'cancel');
CREATE TYPE "OrderChannel" AS ENUM ('web', 'telegram');
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'failed', 'expired', 'cancelled');
CREATE TYPE "ResultStatus" AS ENUM ('success', 'partial', 'failed');

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "estimate" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "services_code_key" ON "services"("code");

CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "channel" "OrderChannel" NOT NULL DEFAULT 'web',
    "imei" TEXT NOT NULL,
    "notes" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'waiting_payment',
    "price" INTEGER NOT NULL,
    "assigned_admin_id" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "orders_order_id_key" ON "orders"("order_id");
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at");
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at");
CREATE INDEX "orders_imei_idx" ON "orders"("imei");

CREATE TABLE "payment_invoices" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "payment_channel" TEXT NOT NULL DEFAULT 'qris_placeholder',
    "payment_reference" TEXT,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "expired_at" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "gateway_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_invoices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payment_invoices_invoice_id_key" ON "payment_invoices"("invoice_id");
CREATE UNIQUE INDEX "payment_invoices_order_id_key" ON "payment_invoices"("order_id");

CREATE TABLE "order_activity_logs" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "note" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_activity_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "order_activity_logs_order_id_created_at_idx" ON "order_activity_logs"("order_id", "created_at");

CREATE TABLE "order_results" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "result_status" "ResultStatus" NOT NULL,
    "result_note" TEXT NOT NULL,
    "result_data" JSONB,
    "created_by_admin_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_results_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "order_results_order_id_key" ON "order_results"("order_id");

ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_assigned_admin_id_fkey" FOREIGN KEY ("assigned_admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_invoices" ADD CONSTRAINT "payment_invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_activity_logs" ADD CONSTRAINT "order_activity_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_results" ADD CONSTRAINT "order_results_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_results" ADD CONSTRAINT "order_results_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
