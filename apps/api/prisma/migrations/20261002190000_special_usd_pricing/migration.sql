-- AlterTable
ALTER TABLE "services" ADD COLUMN     "cost_usd_cents" INTEGER,
ADD COLUMN     "price_usd_cents" INTEGER;

-- Layanan Spesial were imported with the supplier's USD credit stored as if it were Rupiah.
-- Keep those numbers as dollars and derive Rupiah at the default rate ($1 = Rp17.000).
UPDATE "services"
SET "price_usd_cents" = "price" * 100,
    "cost_usd_cents" = "cost_price" * 100,
    "price" = "price" * 17000,
    "cost_price" = "cost_price" * 17000
WHERE "fulfillment_channel" = 'supplier'
  AND "menu" = 'special';
