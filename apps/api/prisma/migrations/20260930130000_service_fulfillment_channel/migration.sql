-- CreateEnum
CREATE TYPE "FulfillmentChannel" AS ENUM ('telegram', 'whatsapp');

-- AlterTable
ALTER TABLE "services" ADD COLUMN "fulfillment_channel" "FulfillmentChannel" NOT NULL DEFAULT 'telegram';

-- AlterTable
ALTER TABLE "order_results" ALTER COLUMN "created_by_admin_id" DROP NOT NULL;
