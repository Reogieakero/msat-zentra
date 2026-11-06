-- ADM monitoring: adviser-pasted link to the student's answered module.
-- Kept idempotent so a re-apply on a DB that already has the column is a no-op.
ALTER TABLE "AdmModule"
  ADD COLUMN IF NOT EXISTS "studentSubmissionUrl" TEXT;
