-- AlterTable
ALTER TABLE "services" ADD COLUMN     "require_sign_in_picture" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "sign_in_picture" TEXT;
