-- CreateEnum
CREATE TYPE "ServiceMenu" AS ENUM ('ceir', 'special');

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "menu" "ServiceMenu" NOT NULL DEFAULT 'ceir';

-- CeirBot checks use `ceir-<code>` ids; every other supplier service was already treated as Layanan Spesial.
UPDATE "services"
SET "menu" = 'special'
WHERE "fulfillment_channel" = 'supplier'
  AND "supplier_service_id" IS NOT NULL
  AND lower("supplier_service_id") NOT LIKE 'ceir-%';
