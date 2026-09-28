-- Teacher names become a plain display-name catalog (no accounts involved):
-- new TeacherName table, and entries point at it instead of User.
CREATE TABLE "TeacherName" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "TeacherName_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherName_name_key" ON "TeacherName"("name");

ALTER TABLE "SectionTimetableEntry" DROP CONSTRAINT "SectionTimetableEntry_teacherId_fkey";

ALTER TABLE "SectionTimetableEntry" DROP COLUMN "teacherId";

ALTER TABLE "SectionTimetableEntry" ADD COLUMN "teacherNameId" TEXT;

ALTER TABLE "SectionTimetableEntry" ADD CONSTRAINT "SectionTimetableEntry_teacherNameId_fkey" FOREIGN KEY ("teacherNameId") REFERENCES "TeacherName"("id") ON DELETE CASCADE ON UPDATE CASCADE;
