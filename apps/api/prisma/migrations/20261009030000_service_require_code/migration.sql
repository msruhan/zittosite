-- AlterTable
ALTER TABLE "services" ADD COLUMN     "require_code" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "code_text" TEXT;
