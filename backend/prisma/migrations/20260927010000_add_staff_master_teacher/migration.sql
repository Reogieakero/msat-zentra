-- Master Teacher designation on staff profiles (grades 7–10 only).
-- Self-declared by the teacher from Settings; the update endpoint enforces
-- the grade band. Defaults to false for all existing rows.
ALTER TABLE "StaffProfile" ADD COLUMN "isMasterTeacher" BOOLEAN NOT NULL DEFAULT false;
