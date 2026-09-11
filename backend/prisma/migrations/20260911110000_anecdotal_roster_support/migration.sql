-- Anecdotal profiling for enlisted students without accounts: AnecdotalRecord
-- gains an optional rosterId (exactly one of studentId/rosterId is set).
ALTER TABLE "AnecdotalRecord" ADD COLUMN "rosterId" TEXT;
ALTER TABLE "AnecdotalRecord" ALTER COLUMN "studentId" DROP NOT NULL;
ALTER TABLE "AnecdotalRecord" ADD CONSTRAINT "AnecdotalRecord_rosterId_fkey"
  FOREIGN KEY ("rosterId") REFERENCES "StudentRoster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnecdotalRecord" ADD CONSTRAINT "AnecdotalRecord_student_or_roster_check"
  CHECK ((("studentId" IS NOT NULL)::int + ("rosterId" IS NOT NULL)::int) = 1);
CREATE INDEX "AnecdotalRecord_rosterId_idx" ON "AnecdotalRecord"("rosterId");
