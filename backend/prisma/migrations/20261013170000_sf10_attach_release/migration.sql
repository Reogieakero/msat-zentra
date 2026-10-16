-- SF10 attach/release only: the middle "available" state is gone. Uploads
-- file straight to attached; releasing archives from attached. Existing
-- available rows move back to attached (their validatedBy/validatedAt
-- history is kept as-is).
-- Uses IF NOT EXISTS-safe statements so the migration is safe to re-run.

UPDATE "Sf10Record" SET "status" = 'attach' WHERE "status" = 'available';
