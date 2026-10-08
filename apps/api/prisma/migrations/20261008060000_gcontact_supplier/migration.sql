-- CreateEnum
CREATE TYPE "SupplierKind" AS ENUM ('dhru', 'gcontact');

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN "kind" "SupplierKind" NOT NULL DEFAULT 'dhru';

-- AlterEnum
ALTER TYPE "ServiceInputType" ADD VALUE 'phone';
