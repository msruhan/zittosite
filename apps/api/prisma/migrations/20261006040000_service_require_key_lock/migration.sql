-- AlterTable
ALTER TABLE "services" ADD COLUMN     "require_key_lock" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "key_lock" TEXT;
