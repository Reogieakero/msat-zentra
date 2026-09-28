-- Track when an assessment was added (displayed as the added date).
ALTER TABLE "Assessment" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
