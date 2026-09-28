-- AlterTable
ALTER TABLE "payment_invoices" ADD COLUMN "amount_due" INTEGER,
ADD COLUMN "qris_string" TEXT,
ADD COLUMN "checkout_url" TEXT;

-- CreateIndex
CREATE INDEX "payment_invoices_payment_reference_idx" ON "payment_invoices"("payment_reference");
