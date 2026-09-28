-- Legacy AM/PM uniqueness must only constrain legacy rows (subjectId NULL).
-- As full uniques, (student|roster, date, session) also blocked subject-era
-- rows: a second subject marked on the same day — or any pre-existing legacy
-- row — collided and failed the write. Replace them with partial indexes so
-- several subjects can share one student-day while legacy dedup is kept.
-- Note: the pre-existing uniqueness lives as standalone unique indexes
-- (not table constraints), so both drop forms are attempted.
ALTER TABLE "AttendanceRecord" DROP CONSTRAINT IF EXISTS "AttendanceRecord_studentId_date_session_key";
ALTER TABLE "AttendanceRecord" DROP CONSTRAINT IF EXISTS "AttendanceRecord_rosterId_date_session_key";
DROP INDEX IF EXISTS "AttendanceRecord_studentId_date_session_key";
DROP INDEX IF EXISTS "AttendanceRecord_rosterId_date_session_key";

CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceRecord_studentId_date_session_legacy_key"
  ON "AttendanceRecord"("studentId", "date", "session") WHERE "subjectId" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceRecord_rosterId_date_session_legacy_key"
  ON "AttendanceRecord"("rosterId", "date", "session") WHERE "subjectId" IS NULL;
