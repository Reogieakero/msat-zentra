-- Track sign-outs alongside sign-ins for the administrator overview chart.
-- Existing rows are sign-ins, so the new column defaults to 'login'.

DO $$
BEGIN
  CREATE TYPE "LoginEventKind" AS ENUM ('login', 'logout');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "LoginEvent"
  ADD COLUMN IF NOT EXISTS "kind" "LoginEventKind" NOT NULL DEFAULT 'login';

CREATE INDEX IF NOT EXISTS "LoginEvent_kind_occurredAt_idx"
  ON "LoginEvent"("kind", "occurredAt");
