-- Add new referral statuses and fields for guidance actions

ALTER TYPE "ReferralStatus" ADD VALUE 'escalated';
ALTER TYPE "ReferralStatus" ADD VALUE 'info_requested';
ALTER TYPE "ReferralStatus" ADD VALUE 'dismissed';
ALTER TYPE "ReferralStatus" ADD VALUE 'follow_up';

ALTER TYPE "ActionType" ADD VALUE 'referral_escalated';
ALTER TYPE "ActionType" ADD VALUE 'referral_reassigned';
ALTER TYPE "ActionType" ADD VALUE 'referral_note_added';
ALTER TYPE "ActionType" ADD VALUE 'referral_follow_up';
ALTER TYPE "ActionType" ADD VALUE 'referral_dismissed';
ALTER TYPE "ActionType" ADD VALUE 'referral_referred_specialist';
ALTER TYPE "ActionType" ADD VALUE 'referral_adm_initiated';

ALTER TABLE "Referral" ADD COLUMN "notes" TEXT;
ALTER TABLE "Referral" ADD COLUMN "escalationReason" TEXT;
ALTER TABLE "Referral" ADD COLUMN "followUpDate" TIMESTAMP;
ALTER TABLE "Referral" ADD COLUMN "escalatedTo" TEXT;