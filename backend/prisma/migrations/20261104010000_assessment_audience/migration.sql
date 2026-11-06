-- Assessment audience: regular classes vs signed ADM learners.
CREATE TYPE "AssessmentAudience" AS ENUM ('regular', 'adm');

ALTER TABLE "Assessment"
  ADD COLUMN "audience" "AssessmentAudience" NOT NULL DEFAULT 'regular';
