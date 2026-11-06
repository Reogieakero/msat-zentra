-- Modules gain a type: `general` is a post-only announcement (no submission
-- tracking), `adm` is released to the section's ADM learners and tracked.
-- Existing modules were tracking submissions, so they backfill to `adm`; new
-- modules default to `general`.
CREATE TYPE "AdvisoryModuleKind" AS ENUM ('general', 'adm');

ALTER TABLE "AdvisoryModule"
  ADD COLUMN "kind" "AdvisoryModuleKind" NOT NULL DEFAULT 'adm';

ALTER TABLE "AdvisoryModule" ALTER COLUMN "kind" SET DEFAULT 'general';
