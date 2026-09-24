-- Parent/guardian meetings can be booked directly on a referral, before any
-- learner profile (and before the student has an account). One side is
-- always set: profile bookings keep admLearnerProfileId, pre-profile
-- bookings carry referralId and transfer to the profile on creation.
-- IF NOT EXISTS / guarded constraints keep this safe to re-apply.
ALTER TABLE "AdmParentMeeting" ADD COLUMN IF NOT EXISTS "referralId" TEXT;
ALTER TABLE "AdmParentMeeting" ALTER COLUMN "admLearnerProfileId" DROP NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdmParentMeeting_referralId_fkey') THEN
    ALTER TABLE "AdmParentMeeting" ADD CONSTRAINT "AdmParentMeeting_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdmParentMeeting_owner_check') THEN
    ALTER TABLE "AdmParentMeeting" ADD CONSTRAINT "AdmParentMeeting_owner_check" CHECK (("admLearnerProfileId" IS NOT NULL)::int + ("referralId" IS NOT NULL)::int = 1);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "AdmParentMeeting_referralId_idx" ON "AdmParentMeeting"("referralId");
