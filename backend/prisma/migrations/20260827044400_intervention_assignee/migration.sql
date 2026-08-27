-- AlterTable
ALTER TABLE "Intervention" ADD COLUMN "assignedTo" TEXT;

ALTER TABLE "Intervention" ADD COLUMN "assignedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Intervention_assignedTo_idx" ON "Intervention"("assignedTo");
