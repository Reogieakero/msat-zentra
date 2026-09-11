-- Attendance for enlisted students without accounts: AttendanceRecord gains
-- an optional rosterId (exactly one of studentId/rosterId is set).
ALTER TABLE "AttendanceRecord" ADD COLUMN "rosterId" TEXT;
ALTER TABLE "AttendanceRecord" ALTER COLUMN "studentId" DROP NOT NULL;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_rosterId_fkey"
  FOREIGN KEY ("rosterId") REFERENCES "StudentRoster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_student_or_roster_check"
  CHECK ((("studentId" IS NOT NULL)::int + ("rosterId" IS NOT NULL)::int) = 1);
CREATE UNIQUE INDEX "AttendanceRecord_rosterId_date_session_key" ON "AttendanceRecord"("rosterId", "date", "session");
CREATE INDEX "AttendanceRecord_rosterId_idx" ON "AttendanceRecord"("rosterId");
