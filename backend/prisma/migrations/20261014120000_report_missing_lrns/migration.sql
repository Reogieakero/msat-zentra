-- Adviser SF10 access requests: desk-reported missing LRNs. "Report as
-- missing" per requested student stores the LRN here and notifies the
-- adviser, independent of the approve/deny verdict.
-- Uses IF NOT EXISTS-safe statements so the migration is safe to re-run.

ALTER TABLE "AdviserSf10AccessRequest"
  ADD COLUMN IF NOT EXISTS "reportedMissingLrns" TEXT[] NOT NULL DEFAULT '{}';
