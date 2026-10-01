-- AlterTable
ALTER TABLE "services" ADD COLUMN     "cost_price" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cost_price" INTEGER NOT NULL DEFAULT 0;
