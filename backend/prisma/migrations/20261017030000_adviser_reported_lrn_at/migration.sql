-- Adviser SF10 access requests: per-LRN report timestamps. Each
-- per-student "report missing" stamps reportedLrnAt[LRN] with the
-- confirmation time so the requests chart can bucket reported students by
-- date (mirrors approvedLrnAt).
-- Uses IF NOT EXISTS-safe statements so the migration is safe to re-run.

ALTER TABLE "AdviserSf10AccessRequest"
  ADD COLUMN IF NOT EXISTS "reportedLrnAt" JSONB;
