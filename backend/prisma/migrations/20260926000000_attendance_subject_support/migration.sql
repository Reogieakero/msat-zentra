-- Attendance AM/PM -> per-subject migration (staged, non-destructive).
--
-- 1. Creates AttendanceRecordLegacy archive table and copies every existing
--    AM/PM row into it (preserves history even if live rows are later edited).
-- 2. Adds subjectId / assignmentId / slot to AttendanceRecord (nullable
--    subjectId so legacy rows stay valid; new writes require subjectId at the
--    application layer).
-- 3. Adds the subject-era unique keys + indexes. Nullable-column UNIQUEs treat
--    NULLs as distinct in Postgres, so legacy rows (subjectId NULL) never
--    conflict with subject rows — same semantics as the existing
--    studentId/rosterId split.
-- 4. Back-relations need no data migration.
--
-- Verify after apply:
--   SELECT COUNT(*) FROM "AttendanceRecord";
--   SELECT COUNT(*) FROM "AttendanceRecordLegacy";  -- must match above

-- 1. Archive table (frozen copy of the pre-migration AM/PM model).
CREATE TABLE IF NOT EXISTS "AttendanceRecordLegacy" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" TEXT,
  "rosterId" TEXT,
  "sectionId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "session" "Session" NOT NULL,
  "status" "AttendanceStatus" NOT NULL,
  "recordedBy" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AttendanceRecordLegacy_sectionId_termId_idx"
  ON "AttendanceRecordLegacy"("sectionId", "termId");
CREATE INDEX IF NOT EXISTS "AttendanceRecordLegacy_studentId_termId_idx"
  ON "AttendanceRecordLegacy"("studentId", "termId");
CREATE INDEX IF NOT EXISTS "AttendanceRecordLegacy_rosterId_idx"
  ON "AttendanceRecordLegacy"("rosterId");

-- Idempotent archive copy: only rows not yet archived.
INSERT INTO "AttendanceRecordLegacy"
  ("id", "studentId", "rosterId", "sectionId", "date", "session", "status", "recordedBy", "termId")
SELECT a."id", a."studentId", a."rosterId", a."sectionId", a."date", a."session", a."status", a."recordedBy", a."termId"
FROM "AttendanceRecord" a
LEFT JOIN "AttendanceRecordLegacy" l ON l."id" = a."id"
WHERE l."id" IS NULL;

-- 2. New columns on the live table.
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "subjectId" TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "assignmentId" TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "slot" SMALLINT NOT NULL DEFAULT 1;

-- Keep legacy writes valid: session default AM for new subject rows that do
-- not carry a session (application always sends subjectId+slot instead).
ALTER TABLE "AttendanceRecord" ALTER COLUMN "session" SET DEFAULT 'AM';

-- Slot sanity: 1-based occurrence number.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceRecord_slot_check'
  ) THEN
    ALTER TABLE "AttendanceRecord"
      ADD CONSTRAINT "AttendanceRecord_slot_check" CHECK ("slot" >= 1);
  END IF;
END $$;

-- 3. Foreign keys (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceRecord_subjectId_fkey'
  ) THEN
    ALTER TABLE "AttendanceRecord"
      ADD CONSTRAINT "AttendanceRecord_subjectId_fkey"
      FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceRecord_assignmentId_fkey'
  ) THEN
    ALTER TABLE "AttendanceRecord"
      ADD CONSTRAINT "AttendanceRecord_assignmentId_fkey"
      FOREIGN KEY ("assignmentId") REFERENCES "TeacherSubjectAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Subject-era unique keys (dedupes per student/roster + subject + day + slot).
CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceRecord_studentId_subjectId_date_slot_key"
  ON "AttendanceRecord"("studentId", "subjectId", "date", "slot");
CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceRecord_rosterId_subjectId_date_slot_key"
  ON "AttendanceRecord"("rosterId", "subjectId", "date", "slot");

-- 5. Lookup indexes for subject-scoped reads.
CREATE INDEX IF NOT EXISTS "AttendanceRecord_subjectId_termId_idx"
  ON "AttendanceRecord"("subjectId", "termId");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_sectionId_subjectId_termId_idx"
  ON "AttendanceRecord"("sectionId", "subjectId", "termId");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_assignmentId_idx"
  ON "AttendanceRecord"("assignmentId");
