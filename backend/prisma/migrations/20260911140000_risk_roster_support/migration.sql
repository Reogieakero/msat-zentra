-- Risk engine for enlisted students without accounts: RiskSnapshot and
-- Intervention gain an optional rosterId (exactly one of studentId/rosterId set).
ALTER TABLE "RiskSnapshot" ADD COLUMN "rosterId" TEXT;
ALTER TABLE "RiskSnapshot" ALTER COLUMN "studentId" DROP NOT NULL;
ALTER TABLE "RiskSnapshot" ADD CONSTRAINT "RiskSnapshot_rosterId_fkey"
  FOREIGN KEY ("rosterId") REFERENCES "StudentRoster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiskSnapshot" ADD CONSTRAINT "RiskSnapshot_student_or_roster_check"
  CHECK ((("studentId" IS NOT NULL)::int + ("rosterId" IS NOT NULL)::int) = 1);
CREATE INDEX "RiskSnapshot_rosterId_idx" ON "RiskSnapshot"("rosterId");

ALTER TABLE "Intervention" ADD COLUMN "rosterId" TEXT;
ALTER TABLE "Intervention" ALTER COLUMN "studentId" DROP NOT NULL;
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_rosterId_fkey"
  FOREIGN KEY ("rosterId") REFERENCES "StudentRoster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_student_or_roster_check"
  CHECK ((("studentId" IS NOT NULL)::int + ("rosterId" IS NOT NULL)::int) = 1);
CREATE INDEX "Intervention_rosterId_idx" ON "Intervention"("rosterId");
