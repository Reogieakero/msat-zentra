-- Advisory modules become term-scoped so the Modules desk (and the ADM case
-- desks that merge the section's ADM modules) only show the selected term.
-- Additive; legacy rows are backfilled to the term that matches their release
-- (or creation) date inside the section's school year. When no term window
-- contains that date, the nearest term wins so no row is left untagged.
ALTER TABLE "AdvisoryModule"
  ADD COLUMN IF NOT EXISTS "termId" TEXT;

UPDATE "AdvisoryModule" m
SET "termId" = ranked."term_id"
FROM (
  SELECT
    mod."id" AS "module_id",
    t."id" AS "term_id",
    ROW_NUMBER() OVER (
      PARTITION BY mod."id"
      ORDER BY
        CASE
          WHEN ref."d" >= COALESCE(t."startDate", '-infinity'::timestamp)
           AND ref."d" <= COALESCE(t."endDate", 'infinity'::timestamp)
          THEN 0
          ELSE 1
        END,
        ABS(EXTRACT(EPOCH FROM (ref."d" - COALESCE(t."startDate", ref."d")))),
        t."termNumber" ASC
    ) AS "rn"
  FROM "AdvisoryModule" mod
  JOIN "Section" s ON s."id" = mod."sectionId"
  JOIN "Term" t ON t."schoolYearId" = s."schoolYearId"
  CROSS JOIN LATERAL (
    SELECT COALESCE(mod."releaseDate", mod."createdAt") AS "d"
  ) ref
  WHERE mod."termId" IS NULL
) ranked
WHERE ranked."module_id" = m."id" AND ranked."rn" = 1;

CREATE INDEX IF NOT EXISTS "AdvisoryModule_termId_idx"
  ON "AdvisoryModule"("termId");

ALTER TABLE "AdvisoryModule"
  DROP CONSTRAINT IF EXISTS "AdvisoryModule_termId_fkey";
ALTER TABLE "AdvisoryModule"
  ADD CONSTRAINT "AdvisoryModule_termId_fkey"
  FOREIGN KEY ("termId") REFERENCES "Term"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
