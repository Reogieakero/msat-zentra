-- Attendance unlock persists on the linked catalog row: once the teacher
-- verifies their code, the attendance page stops asking until the row is
-- unlinked (which clears both the login link and this flag).
ALTER TABLE "TeacherName" ADD COLUMN "attendanceVerifiedAt" TIMESTAMPTZ;
