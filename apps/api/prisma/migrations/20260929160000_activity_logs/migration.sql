-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_name" TEXT,
    "actor_role" TEXT,
    "target_label" TEXT,
    "order_id" TEXT,
    "summary" TEXT NOT NULL,
    "ip" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "activity_logs_category_created_at_idx" ON "activity_logs"("category", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_event_created_at_idx" ON "activity_logs"("event", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_order_id_idx" ON "activity_logs"("order_id");

