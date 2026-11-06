-- Adviser SF10 access requests: per-student approvals. "Approve" per matched
-- student (or "approve all" matched) stores the LRN here and notifies the
-- adviser. Whole-request approval via decideAccess still grants everything.
-- Uses IF NOT EXISTS-safe statements so the migration is safe to re-run.

ALTER TABLE "AdviserSf10AccessRequest"
  ADD COLUMN IF NOT EXISTS "approvedLrns" TEXT[] NOT NULL DEFAULT '{}';
