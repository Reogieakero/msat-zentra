-- Add uploadedAt + updatedAt tracking columns to "Sf10Record" so the registrar
-- repository can show upload time and last-updated time, and order by recency.
-- Note: Prisma maps model Sf10Record to table "Sf10Record" (no @map override).
ALTER TABLE "Sf10Record" ADD COLUMN "uploadedAt" TIMESTAMP(3);
ALTER TABLE "Sf10Record" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now();
