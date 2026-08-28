-- AddEnum
CREATE TYPE "AdmStage" AS ENUM ('anecdotal', 'consultation', 'meeting_parents', 'home_visitation', 'certification', 'principal_approval', 'enrollment_monitoring', 'completion');

-- AlterTable
ALTER TABLE "AdmLearnerProfile" ADD COLUMN "stage" "AdmStage" NOT NULL DEFAULT 'anecdotal';

-- Backfill existing rows: a profile signed by the principal sits at principal_approval,
-- otherwise an eligible profile has reached certification, else it is still at the meeting stage.
UPDATE "AdmLearnerProfile"
SET "stage" = 'principal_approval'
WHERE "approvedBy" IS NOT NULL;

UPDATE "AdmLearnerProfile"
SET "stage" = 'certification'
WHERE "approvedBy" IS NULL AND "eligibilityStatus" = 'eligible';

UPDATE "AdmLearnerProfile"
SET "stage" = 'meeting_parents'
WHERE "approvedBy" IS NULL AND "eligibilityStatus" <> 'eligible';
