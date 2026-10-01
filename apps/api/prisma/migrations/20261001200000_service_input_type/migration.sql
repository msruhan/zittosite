-- CreateEnum
CREATE TYPE "ServiceInputType" AS ENUM ('imei', 'sn', 'ecid');

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "input_type" "ServiceInputType" NOT NULL DEFAULT 'imei';
