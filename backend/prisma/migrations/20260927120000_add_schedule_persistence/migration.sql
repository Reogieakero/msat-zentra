-- Master-teacher scheduling persistence: day-shape config per term and
-- timetable cells per section/subject/day/period.
CREATE TABLE "ScheduleConfig" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL DEFAULT '07:30',
    "periodMins" INTEGER NOT NULL DEFAULT 60,
    "lunchAfter" INTEGER NOT NULL DEFAULT 4,
    "lunchMins" INTEGER NOT NULL DEFAULT 90,
    "recessAmOn" BOOLEAN NOT NULL DEFAULT false,
    "recessAmAfter" INTEGER NOT NULL DEFAULT 2,
    "recessAmMins" INTEGER NOT NULL DEFAULT 15,
    "recessPmOn" BOOLEAN NOT NULL DEFAULT false,
    "recessPmAfter" INTEGER NOT NULL DEFAULT 6,
    "recessPmMins" INTEGER NOT NULL DEFAULT 15,

    CONSTRAINT "ScheduleConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScheduleConfig_termId_key" ON "ScheduleConfig"("termId");

CREATE TABLE "SectionTimetableEntry" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,

    CONSTRAINT "SectionTimetableEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SectionTimetableEntry_sectionId_termId_day_period_key" ON "SectionTimetableEntry"("sectionId", "termId", "day", "period");
CREATE INDEX "SectionTimetableEntry_sectionId_termId_idx" ON "SectionTimetableEntry"("sectionId", "termId");

ALTER TABLE "ScheduleConfig" ADD CONSTRAINT "ScheduleConfig_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SectionTimetableEntry" ADD CONSTRAINT "SectionTimetableEntry_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SectionTimetableEntry" ADD CONSTRAINT "SectionTimetableEntry_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SectionTimetableEntry" ADD CONSTRAINT "SectionTimetableEntry_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
