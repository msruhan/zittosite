-- The fixed menu enum becomes the style of admin-defined menus.
ALTER TYPE "ServiceMenu" RENAME TO "MenuStyle";

CREATE TYPE "MenuCurrency" AS ENUM ('IDR', 'USD');

CREATE TABLE "service_menus" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "style" "MenuStyle" NOT NULL DEFAULT 'ceir',
    "price_currency" "MenuCurrency" NOT NULL DEFAULT 'IDR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_menus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_menus_slug_key" ON "service_menus"("slug");

-- The two built-in menus keep their behaviour: Order Ceir in Rupiah, Layanan Spesial in USD.
INSERT INTO "service_menus" ("id", "slug", "label", "enabled", "sort_order", "style", "price_currency", "updated_at")
VALUES
    ('menu_ceir', 'ceir', 'Order Ceir', true, 10, 'ceir', 'IDR', CURRENT_TIMESTAMP),
    ('menu_special', 'special', 'Layanan Spesial', true, 20, 'special', 'USD', CURRENT_TIMESTAMP);

-- Names and switches set in Settings → Menu user move onto the rows.
UPDATE "service_menus" AS m
SET "label" = COALESCE(NULLIF(trim(s."value" -> m."slug" ->> 'label'), ''), m."label"),
    "enabled" = COALESCE((s."value" -> m."slug" ->> 'enabled')::boolean, m."enabled")
FROM "system_settings" AS s
WHERE s."key" = 'user_menus';

UPDATE "system_settings"
SET "value" = jsonb_build_object('order', "value" -> 'order')
WHERE "key" = 'user_menus' AND jsonb_typeof("value") = 'object';

ALTER TABLE "services" ADD COLUMN "menu_id" TEXT;

UPDATE "services"
SET "menu_id" = CASE "menu" WHEN 'special' THEN 'menu_special' ELSE 'menu_ceir' END
WHERE "fulfillment_channel" = 'supplier';

ALTER TABLE "services" DROP COLUMN "menu";

CREATE INDEX "services_menu_id_idx" ON "services"("menu_id");

ALTER TABLE "services" ADD CONSTRAINT "services_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "service_menus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
