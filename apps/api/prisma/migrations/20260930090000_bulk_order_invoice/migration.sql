-- One invoice can now pay for several orders (bulk order).
ALTER TABLE "orders" ADD COLUMN "invoice_row_id" TEXT;

UPDATE "orders" o
SET "invoice_row_id" = pi."id"
FROM "payment_invoices" pi
WHERE pi."order_id" = o."id";

CREATE INDEX "orders_invoice_row_id_idx" ON "orders"("invoice_row_id");

ALTER TABLE "orders" ADD CONSTRAINT "orders_invoice_row_id_fkey" FOREIGN KEY ("invoice_row_id") REFERENCES "payment_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_invoices" DROP CONSTRAINT "payment_invoices_order_id_fkey";
DROP INDEX "payment_invoices_order_id_key";
ALTER TABLE "payment_invoices" DROP COLUMN "order_id";
