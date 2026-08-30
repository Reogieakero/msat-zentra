-- Add claimed LRN captured at student sign-up, verified against StudentRoster at approval.
ALTER TABLE "User" ADD COLUMN "lrn" TEXT;
