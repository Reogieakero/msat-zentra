-- Subject category (Core vs Elective) + code uniqueness scoped per grade level,
-- so the same subject code can exist in more than one grade (e.g. Grade 11 and 12).
CREATE TYPE "SubjectCategory" AS ENUM ('CORE', 'ELECTIVE');
ALTER TABLE "Subject" ADD COLUMN "category" "SubjectCategory" NOT NULL DEFAULT 'CORE';
DROP INDEX "Subject_code_key";
CREATE UNIQUE INDEX "Subject_code_gradeLevel_key" ON "Subject"("code", "gradeLevel");
