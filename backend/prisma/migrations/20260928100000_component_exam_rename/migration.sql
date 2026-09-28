-- Rename ComponentType.QUARTERLY_EXAM to EXAM (display label: "Exam").
-- Transaction-safe swap (no RENAME VALUE): existing QUARTERLY_EXAM rows are
-- mapped to EXAM during the column conversion.
CREATE TYPE "ComponentType_new" AS ENUM ('WRITTEN_WORK', 'PERFORMANCE_TASK', 'EXAM');
ALTER TABLE "GradeComponent" ALTER COLUMN "componentType" TYPE "ComponentType_new" USING (
  CASE WHEN "componentType"::text = 'QUARTERLY_EXAM' THEN 'EXAM'::"ComponentType_new"
  ELSE "componentType"::text::"ComponentType_new" END
);
ALTER TYPE "ComponentType" RENAME TO "ComponentType_old";
ALTER TYPE "ComponentType_new" RENAME TO "ComponentType";
DROP TYPE "ComponentType_old";
