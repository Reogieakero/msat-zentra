-- Referrals for enlisted students without accounts: Referral gains an
-- optional rosterId (exactly one of studentId/rosterId is set).
ALTER TABLE "Referral" ADD COLUMN "rosterId" TEXT;
ALTER TABLE "Referral" ALTER COLUMN "studentId" DROP NOT NULL;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_rosterId_fkey"
  FOREIGN KEY ("rosterId") REFERENCES "StudentRoster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_student_or_roster_check"
  CHECK ((("studentId" IS NOT NULL)::int + ("rosterId" IS NOT NULL)::int) = 1);
CREATE INDEX "Referral_rosterId_idx" ON "Referral"("rosterId");
