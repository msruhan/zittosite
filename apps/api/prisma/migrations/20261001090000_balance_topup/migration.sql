-- CreateEnum
CREATE TYPE "InvoicePurpose" AS ENUM ('order', 'topup');

-- AlterTable
ALTER TABLE "payment_invoices" ADD COLUMN "purpose" "InvoicePurpose" NOT NULL DEFAULT 'order',
ADD COLUMN "user_id" TEXT;

-- CreateIndex
CREATE INDEX "payment_invoices_user_id_purpose_created_at_idx" ON "payment_invoices"("user_id", "purpose", "created_at");

-- AddForeignKey
ALTER TABLE "payment_invoices" ADD CONSTRAINT "payment_invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
