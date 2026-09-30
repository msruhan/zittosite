-- CreateTable
CREATE TABLE "balance_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "ref_key" TEXT NOT NULL,
    "order_id" TEXT,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "balance_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "balance_entries_ref_key_key" ON "balance_entries"("ref_key");

-- CreateIndex
CREATE INDEX "balance_entries_user_id_created_at_idx" ON "balance_entries"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "balance_entries" ADD CONSTRAINT "balance_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_entries" ADD CONSTRAINT "balance_entries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
