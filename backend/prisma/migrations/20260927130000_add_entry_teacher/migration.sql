-- Per-slot teacher on timetable entries (nullable: rows created before this
-- feature stay valid and render without a teacher line).
ALTER TABLE "SectionTimetableEntry" ADD COLUMN "teacherId" TEXT;

ALTER TABLE "SectionTimetableEntry" ADD CONSTRAINT "SectionTimetableEntry_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
