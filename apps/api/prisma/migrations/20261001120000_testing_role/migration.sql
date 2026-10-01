-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('customer', 'testing');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'customer';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "is_test" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "payment_invoices" ADD COLUMN "is_test" BOOLEAN NOT NULL DEFAULT false;
