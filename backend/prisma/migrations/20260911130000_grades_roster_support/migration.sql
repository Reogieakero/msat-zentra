-- Grade encoding for enlisted students without accounts: StudentGrade and
-- FinalGrade gain an optional rosterId (exactly one of studentId/rosterId set).
ALTER TABLE "StudentGrade" ADD COLUMN "rosterId" TEXT;
ALTER TABLE "StudentGrade" ALTER COLUMN "studentId" DROP NOT NULL;
ALTER TABLE "StudentGrade" ADD CONSTRAINT "StudentGrade_rosterId_fkey"
  FOREIGN KEY ("rosterId") REFERENCES "StudentRoster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentGrade" ADD CONSTRAINT "StudentGrade_student_or_roster_check"
  CHECK ((("studentId" IS NOT NULL)::int + ("rosterId" IS NOT NULL)::int) = 1);
CREATE UNIQUE INDEX "StudentGrade_assessmentId_rosterId_key" ON "StudentGrade"("assessmentId", "rosterId");
CREATE INDEX "StudentGrade_rosterId_idx" ON "StudentGrade"("rosterId");

ALTER TABLE "FinalGrade" ADD COLUMN "rosterId" TEXT;
ALTER TABLE "FinalGrade" ALTER COLUMN "studentId" DROP NOT NULL;
ALTER TABLE "FinalGrade" ADD CONSTRAINT "FinalGrade_rosterId_fkey"
  FOREIGN KEY ("rosterId") REFERENCES "StudentRoster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinalGrade" ADD CONSTRAINT "FinalGrade_student_or_roster_check"
  CHECK ((("studentId" IS NOT NULL)::int + ("rosterId" IS NOT NULL)::int) = 1);
CREATE UNIQUE INDEX "FinalGrade_rosterId_subjectId_termId_key" ON "FinalGrade"("rosterId", "subjectId", "termId");
CREATE INDEX "FinalGrade_rosterId_idx" ON "FinalGrade"("rosterId");
