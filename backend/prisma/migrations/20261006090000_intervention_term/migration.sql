-- Stamp follow-ups with their filing term so desks never leak cases across terms
ALTER TABLE "Intervention" ADD COLUMN "termId" TEXT;

-- Backfill existing rows: prefer the active year's term containing today,
-- else the active year's first term, else the first term overall (same
-- fallback chain the API uses when no session scope is carried).
UPDATE "Intervention" SET "termId" = COALESCE(
  (
    SELECT "Term"."id" FROM "Term"
    JOIN "SchoolYear" ON "SchoolYear"."id" = "Term"."schoolYearId"
    WHERE "SchoolYear"."isActive" = true
      AND ("Term"."startDate" IS NULL OR "Term"."startDate" <= CURRENT_TIMESTAMP)
      AND ("Term"."endDate" IS NULL OR "Term"."endDate" >= CURRENT_TIMESTAMP)
    ORDER BY "Term"."termNumber" ASC LIMIT 1
  ),
  (
    SELECT "Term"."id" FROM "Term"
    JOIN "SchoolYear" ON "SchoolYear"."id" = "Term"."schoolYearId"
    WHERE "SchoolYear"."isActive" = true
    ORDER BY "Term"."termNumber" ASC LIMIT 1
  ),
  (SELECT "id" FROM "Term" ORDER BY "termNumber" ASC LIMIT 1)
) WHERE "termId" IS NULL;

ALTER TABLE "Intervention" ALTER COLUMN "termId" SET NOT NULL;

CREATE INDEX "Intervention_termId_idx" ON "Intervention"("termId");

ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
