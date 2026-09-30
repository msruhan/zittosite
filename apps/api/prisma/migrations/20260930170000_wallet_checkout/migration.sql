-- AlterTable
ALTER TABLE "payment_invoices" ADD COLUMN "balance_used" INTEGER NOT NULL DEFAULT 0;

-- Results are only success or failed.
UPDATE "order_results" SET "result_status" = 'success' WHERE "result_status" = 'partial';

-- AlterEnum
ALTER TYPE "ResultStatus" RENAME TO "ResultStatus_old";
CREATE TYPE "ResultStatus" AS ENUM ('success', 'failed');
ALTER TABLE "order_results" ALTER COLUMN "result_status" TYPE "ResultStatus" USING ("result_status"::text::"ResultStatus");
DROP TYPE "ResultStatus_old";
