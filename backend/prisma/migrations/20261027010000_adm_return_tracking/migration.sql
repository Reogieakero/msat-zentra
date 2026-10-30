-- Principal returns: track when and why a case was sent back for revision so
-- the principal desk can list returned cases in their own lane.
ALTER TABLE "AdmLearnerProfile"
  ADD COLUMN IF NOT EXISTS "returnedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "returnReason" TEXT;
