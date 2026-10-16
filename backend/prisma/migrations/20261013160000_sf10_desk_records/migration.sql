-- SF10 per-desk records: each desk keeps its own record per student, so an
-- upload is visible only on the desk that filed it. Previously one record
-- per student (unique studentId) was shared across desks, which hid a
-- registrar upload inside the record-keeper table (and vice versa).
-- Uses IF NOT EXISTS so the migration is safe to re-run.
--
-- Backfill keeps prior visibility wherever it can be determined:
-- rows filed by a registrar stay with the registrar; rows with no filer
-- follow the student's grade band (G11+ registrar, else record keeper).

-- New desk enum
DO $$ BEGIN
  CREATE TYPE "Sf10Desk" AS ENUM ('registrar', 'record_keeper');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- One record per (student, desk) instead of one per student
ALTER TABLE "Sf10Record" DROP CONSTRAINT IF EXISTS "Sf10Record_studentId_key";

ALTER TABLE "Sf10Record" ADD COLUMN IF NOT EXISTS "desk" "Sf10Desk" NOT NULL DEFAULT 'record_keeper';

-- Rows filed by a registrar (uploader recorded as validator at upload time)
UPDATE "Sf10Record" r
SET "desk" = 'registrar'
FROM "User" u
WHERE r."validatedBy" = u."id" AND u."role" = 'registrar';

-- Filer unknown (seeds): keep the old band visibility by student grade
UPDATE "Sf10Record" r
SET "desk" = 'registrar'
FROM "StudentProfile" s
WHERE r."validatedBy" IS NULL
  AND r."studentId" = s."userId"
  AND s."gradeLevel" IN ('G11', 'G12');

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attrdef d
    JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    JOIN pg_class c ON c.oid = d.adrelid
    WHERE c.relname = 'Sf10Record' AND a.attname = 'desk'
  ) THEN
    ALTER TABLE "Sf10Record" ALTER COLUMN "desk" DROP DEFAULT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Sf10Record_studentId_desk_key" ON "Sf10Record"("studentId", "desk");
