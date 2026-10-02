-- AlterEnum
ALTER TYPE "ServiceInputType" ADD VALUE 'none';

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "require_qnt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "require_email" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "require_username" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "quantity" INTEGER,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "username" TEXT;
