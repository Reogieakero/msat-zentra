-- Per-record adviser sign-off on anecdotal records. Purely additive:
-- three nullable columns, no data touched.

-- AlterTable
ALTER TABLE "AnecdotalRecord" ADD COLUMN "signedBy" TEXT;

-- AlterTable
ALTER TABLE "AnecdotalRecord" ADD COLUMN "signedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AnecdotalRecord" ADD COLUMN "signatureImageUrl" TEXT;
