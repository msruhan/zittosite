-- CreateTable
CREATE TABLE "service_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_groups_name_key" ON "service_groups"("name");

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "service_group_id" TEXT;

-- CreateIndex
CREATE INDEX "services_service_group_id_idx" ON "services"("service_group_id");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_service_group_id_fkey" FOREIGN KEY ("service_group_id") REFERENCES "service_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
