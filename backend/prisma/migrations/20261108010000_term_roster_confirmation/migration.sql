-- Term roster carry-over: record which term a learner was enlisted in, and let
-- the adviser acknowledge the roster they see for a term. Legacy roster rows
-- keep "enlistedTermId" NULL, which is treated as "not newly enlisted" — we
-- cannot reconstruct their real enlistment dates, so never guess them.
--
-- Idempotent on purpose: some environments already have these objects from a
-- dev `prisma db push`, and CI runs `migrate deploy` against the shared DB.
ALTER TABLE "StudentRoster"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "enlistedTermId" TEXT;

CREATE INDEX IF NOT EXISTS "StudentRoster_enlistedTermId_idx"
  ON "StudentRoster"("enlistedTermId");

ALTER TABLE "StudentRoster"
  DROP CONSTRAINT IF EXISTS "StudentRoster_enlistedTermId_fkey";
ALTER TABLE "StudentRoster"
  ADD CONSTRAINT "StudentRoster_enlistedTermId_fkey"
  FOREIGN KEY ("enlistedTermId") REFERENCES "Term"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "TermRosterConfirmation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "rosterFingerprint" TEXT NOT NULL,
  -- The adviser's answer to "same students and classes as last term?".
  -- true = keep the previous roster/classes as the default view; false =
  -- start the term empty (students stay on the year-shared roster).
  "sameAsPrevious" BOOLEAN NOT NULL DEFAULT true,
  "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TermRosterConfirmation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TermRosterConfirmation"
  ADD COLUMN IF NOT EXISTS "sameAsPrevious" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS "TermRosterConfirmation_userId_termId_kind_key"
  ON "TermRosterConfirmation"("userId", "termId", "kind");

CREATE INDEX IF NOT EXISTS "TermRosterConfirmation_termId_idx"
  ON "TermRosterConfirmation"("termId");

ALTER TABLE "TermRosterConfirmation"
  DROP CONSTRAINT IF EXISTS "TermRosterConfirmation_userId_fkey";
ALTER TABLE "TermRosterConfirmation"
  ADD CONSTRAINT "TermRosterConfirmation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TermRosterConfirmation"
  DROP CONSTRAINT IF EXISTS "TermRosterConfirmation_termId_fkey";
ALTER TABLE "TermRosterConfirmation"
  ADD CONSTRAINT "TermRosterConfirmation_termId_fkey"
  FOREIGN KEY ("termId") REFERENCES "Term"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
