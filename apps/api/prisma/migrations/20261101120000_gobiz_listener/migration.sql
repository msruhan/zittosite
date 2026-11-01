-- CreateIndex
CREATE INDEX "payment_invoices_payment_channel_payment_status_amount_due_idx" ON "payment_invoices"("payment_channel", "payment_status", "amount_due");

-- CreateTable
CREATE TABLE "gobiz_transactions" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "payment_type" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "invoice_id" TEXT,
    "raw" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gobiz_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gobiz_transactions_occurred_at_idx" ON "gobiz_transactions"("occurred_at");
