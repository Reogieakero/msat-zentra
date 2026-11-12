-- Last-known presence for the administrator presence globe.
-- Written on login/refresh and bumped (throttled) by the auth middleware.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastIp"       TEXT,
  ADD COLUMN IF NOT EXISTS "lastCity"     TEXT,
  ADD COLUMN IF NOT EXISTS "lastCountry"  TEXT,
  ADD COLUMN IF NOT EXISTS "lastLat"      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "lastLng"      DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "User_lastActiveAt_idx" ON "User"("lastActiveAt");
