-- Adviser SF10 access requests: per-LRN approval timestamps. Each
-- per-student grant (or bulk "approve all") stamps approvedLrnAt[LRN] with
-- the confirmation time so desks can show the approve date per student.
-- Uses IF NOT EXISTS-safe statements so the migration is safe to re-run.

ALTER TABLE "AdviserSf10AccessRequest"
  ADD COLUMN IF NOT EXISTS "approvedLrnAt" JSONB;
