-- Nurse ADM flow: referral form must be completed before forwarding.
ALTER TABLE "Referral" ADD COLUMN "referralFormReady" BOOLEAN NOT NULL DEFAULT false;
