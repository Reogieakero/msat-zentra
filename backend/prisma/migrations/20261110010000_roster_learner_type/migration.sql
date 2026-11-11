-- Advisory enlistment tag: transferees joined mid-term, so their attendance
-- window starts on the day they were enlisted (StudentRoster.createdAt)
-- instead of the term start date. Existing rows are regular learners.

DO $$
BEGIN
  CREATE TYPE "LearnerType" AS ENUM ('regular', 'transferee');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "StudentRoster"
  ADD COLUMN IF NOT EXISTS "learnerType" "LearnerType" NOT NULL DEFAULT 'regular';
