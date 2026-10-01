-- CreateTable
CREATE TABLE "running_ads" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "link_url" TEXT,
    "tag" TEXT,
    "tag_color" TEXT NOT NULL DEFAULT 'yellow',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "running_ads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "running_ads_is_active_sort_order_idx" ON "running_ads"("is_active", "sort_order");
