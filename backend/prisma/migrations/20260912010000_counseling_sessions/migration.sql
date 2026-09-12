-- Guidance intake on referrals + counseling sessions with strict close-out

ALTER TYPE "ActionType" ADD VALUE 'referral_accepted';
ALTER TYPE "ActionType" ADD VALUE 'session_scheduled';
ALTER TYPE "ActionType" ADD VALUE 'session_completed';
ALTER TYPE "ActionType" ADD VALUE 'session_cancelled';
ALTER TYPE "ActionType" ADD VALUE 'session_rescheduled';

ALTER TABLE "Referral" ADD COLUMN "priority" TEXT;
ALTER TABLE "Referral" ADD COLUMN "intakeNotes" TEXT;
ALTER TABLE "Referral" ADD COLUMN "acceptedAt" TIMESTAMP;
ALTER TABLE "Referral" ADD COLUMN "resolutionSummary" TEXT;
ALTER TABLE "Referral" ADD COLUMN "resolvedAt" TIMESTAMP;

CREATE TABLE "CounselingSession" (
  "id" TEXT NOT NULL,
  "referralId" TEXT NOT NULL,
  "sessionType" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP NOT NULL,
  "venue" TEXT,
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "sessionNotes" TEXT,
  "outcome" TEXT,
  "cancelReason" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP,
  CONSTRAINT "CounselingSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CounselingSession_referralId_idx" ON "CounselingSession"("referralId");

ALTER TABLE "CounselingSession" ADD CONSTRAINT "CounselingSession_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CounselingSession" ADD CONSTRAINT "CounselingSession_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
