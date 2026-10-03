CREATE TABLE "user_service_prices" (
    "user_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_service_prices_pkey" PRIMARY KEY ("user_id","service_id")
);
CREATE INDEX "user_service_prices_service_id_idx" ON "user_service_prices"("service_id");
ALTER TABLE "user_service_prices" ADD CONSTRAINT "user_service_prices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_service_prices" ADD CONSTRAINT "user_service_prices_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
