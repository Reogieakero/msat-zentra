-- Schedule review workflow: timetable fills are drafts until principal
-- approved. Pre-existing rows were created live, so they are grandfathered
-- as APPROVED to keep their gradebook assignments resolving.
CREATE TYPE "TimetableStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED');

ALTER TABLE "SectionTimetableEntry" ADD COLUMN "status" "TimetableStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "SectionTimetableEntry" ADD COLUMN "submittedBy" TEXT;
ALTER TABLE "SectionTimetableEntry" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "SectionTimetableEntry" ADD COLUMN "reviewedBy" TEXT;
ALTER TABLE "SectionTimetableEntry" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "SectionTimetableEntry" ADD COLUMN "reviewNote" TEXT;

ALTER TABLE "SectionTimetableEntry" ADD CONSTRAINT "SectionTimetableEntry_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SectionTimetableEntry" ADD CONSTRAINT "SectionTimetableEntry_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "SectionTimetableEntry" SET "status" = 'APPROVED';

CREATE INDEX "SectionTimetableEntry_termId_status_idx" ON "SectionTimetableEntry"("termId", "status");
