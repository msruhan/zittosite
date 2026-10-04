-- AlterTable
ALTER TABLE "services" ADD COLUMN     "require_password" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "password_enc" TEXT;
