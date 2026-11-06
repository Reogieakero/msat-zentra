-- Adviser SF10 access requests: per-student selection. The adviser picks
-- advisory students via checkboxes; their LRNs are stored here. Empty array
-- means the pre-selection behavior (whole advisory section).
-- Uses IF NOT EXISTS-safe statements so the migration is safe to re-run.

ALTER TABLE "AdviserSf10AccessRequest"
  ADD COLUMN IF NOT EXISTS "requestedLrns" TEXT[] NOT NULL DEFAULT '{}';
