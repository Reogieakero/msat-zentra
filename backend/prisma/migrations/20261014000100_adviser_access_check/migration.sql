-- Adviser SF10 access requests: registry verification state. The
-- record-keeper/registrar runs the SF10 LRN check (attached vs missing)
-- before approving; approving without a check is rejected. Re-runnable —
-- each run overwrites the previous verification stamp + summary snapshot.
-- Uses IF NOT EXISTS-safe statements so the migration is safe to re-run.

ALTER TABLE "AdviserSf10AccessRequest"
  ADD COLUMN IF NOT EXISTS "checkedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "checkedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "checkSummary" JSONB;
