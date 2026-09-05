-- Teacher's one reusable drawn signature for stamping anecdotal records.
-- Purely additive: one nullable column, no data touched.

-- AlterTable
ALTER TABLE "StaffProfile" ADD COLUMN "signatureImageUrl" TEXT;
