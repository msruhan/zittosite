CREATE TABLE "service_assignments" (
    "service_id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "service_assignments_pkey" PRIMARY KEY ("service_id","admin_id")
);
CREATE INDEX "service_assignments_admin_id_idx" ON "service_assignments"("admin_id");
ALTER TABLE "service_assignments" ADD CONSTRAINT "service_assignments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_assignments" ADD CONSTRAINT "service_assignments_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
