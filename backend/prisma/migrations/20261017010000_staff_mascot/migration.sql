-- Teacher profile mascot: sprite character picked from Settings
-- (same 55-character pool as learners). Takes precedence over photoUrl
-- when set. Safe to re-run.
ALTER TABLE "StaffProfile" ADD COLUMN IF NOT EXISTS "mascot" TEXT;
