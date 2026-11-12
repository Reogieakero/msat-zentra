-- Anecdotal record soft delete: the adviser can remove a misfiled GCForm-01
-- and restore it later from the anecdotal desk. Every read filters
-- "deletedAt" IS NULL; records that carry a referral are never deleted.
ALTER TABLE "AnecdotalRecord"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

CREATE INDEX IF NOT EXISTS "AnecdotalRecord_observerId_deletedAt_idx"
  ON "AnecdotalRecord" ("observerId", "deletedAt");
