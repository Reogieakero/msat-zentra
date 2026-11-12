-- Sign-in history for the administrator overview's login-activity chart.

CREATE TABLE IF NOT EXISTS "LoginEvent" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "ip"         TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LoginEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LoginEvent_occurredAt_idx" ON "LoginEvent"("occurredAt");
CREATE INDEX IF NOT EXISTS "LoginEvent_userId_occurredAt_idx" ON "LoginEvent"("userId", "occurredAt");

DO $$
BEGIN
  ALTER TABLE "LoginEvent"
    ADD CONSTRAINT "LoginEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
