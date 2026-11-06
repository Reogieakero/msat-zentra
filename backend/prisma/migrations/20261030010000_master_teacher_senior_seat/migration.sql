-- Split the Master Teacher designation into two independent band seats:
-- G7–G10 (existing `isMasterTeacher`) and G11–G12 (new
-- `isMasterTeacherSenior`). One holder per seat, and a teacher may hold both.
ALTER TABLE "StaffProfile"
  ADD COLUMN IF NOT EXISTS "isMasterTeacherSenior" BOOLEAN NOT NULL DEFAULT false;
