-- ADM monitoring: adviser-pasted module upload links + notes.
-- Applied manually via the Supabase SQL editor (the pooler times out
-- `prisma migrate dev`), then recorded by CI with `prisma migrate deploy`.
-- Kept idempotent so a re-apply on a DB that already has the columns is a no-op.
ALTER TABLE "AdmModule"
  ADD COLUMN IF NOT EXISTS "submissionUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "remarks" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
