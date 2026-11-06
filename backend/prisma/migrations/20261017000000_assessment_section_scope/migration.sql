-- Section-subject scope for assessments: an assessment belongs to exactly
-- one subject-section class (the section it was added from), not to the
-- whole subject across sections. Nullable so pre-scope rows stay visible
-- everywhere (legacy shared); all new rows set sectionId from the workspace
-- assignment. Existing shared rows keep sectionId NULL and remain visible
-- in every section teaching that subject until teachers recreate them
-- per section.

ALTER TABLE "Assessment" ADD COLUMN "sectionId" TEXT;

ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Assessment_sectionId_idx" ON "Assessment"("sectionId");

CREATE INDEX "Assessment_sectionId_gradeComponentId_idx" ON "Assessment"("sectionId", "gradeComponentId");
