-- AlterEnum
ALTER TYPE "FulfillmentChannel" ADD VALUE 'supplier';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "supplier_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "supplier_checked_at" TIMESTAMP(3),
ADD COLUMN     "supplier_error" TEXT,
ADD COLUMN     "supplier_id" TEXT,
ADD COLUMN     "supplier_ref" TEXT,
ADD COLUMN     "supplier_submitted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "supplier_id" TEXT,
ADD COLUMN     "supplier_service_id" TEXT;

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "api_key_enc" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_balance" TEXT,
    "last_checked_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orders_supplier_id_status_idx" ON "orders"("supplier_id", "status");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
