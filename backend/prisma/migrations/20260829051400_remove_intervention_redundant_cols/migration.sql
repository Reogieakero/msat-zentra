-- Non-destructive migration: remove redundant columns from Intervention.
-- Interventions are now engine-driven (auto-created + auto-assigned to Guidance),
-- so referralId (no longer linked), reviewedBy (no human reviewer), and
-- approvedAction (dead column) are dropped. Existing data is preserved.

-- Drop foreign-key constraints first.
ALTER TABLE "Intervention" DROP CONSTRAINT IF EXISTS "Intervention_referralId_fkey";
ALTER TABLE "Intervention" DROP CONSTRAINT IF EXISTS "Intervention_reviewedBy_fkey";

-- Drop the redundant columns.
ALTER TABLE "Intervention" DROP COLUMN IF EXISTS "referralId";
ALTER TABLE "Intervention" DROP COLUMN IF EXISTS "reviewedBy";
ALTER TABLE "Intervention" DROP COLUMN IF EXISTS "approvedAction";
