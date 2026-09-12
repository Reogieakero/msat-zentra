-- Counseling sessions + intake on engine follow-ups (same flow as referrals)

ALTER TABLE "Intervention" ADD COLUMN "priority" TEXT;
ALTER TABLE "Intervention" ADD COLUMN "intakeNotes" TEXT;

ALTER TABLE "CounselingSession" ADD COLUMN "interventionId" TEXT;
ALTER TABLE "CounselingSession" ALTER COLUMN "referralId" DROP NOT NULL;

CREATE INDEX "CounselingSession_interventionId_idx" ON "CounselingSession"("interventionId");

ALTER TABLE "CounselingSession" ADD CONSTRAINT "CounselingSession_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CounselingSession" ADD CONSTRAINT "CounselingSession_referral_or_intervention_check"
  CHECK ((("referralId" IS NOT NULL)::int + ("interventionId" IS NOT NULL)::int) = 1);
