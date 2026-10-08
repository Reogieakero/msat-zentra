import { prisma } from "../../lib/prisma.js";
import {
  buildOfferedMap,
  buildSchoolDayAxis,
  countSchoolDays,
  dailyPresentPercent,
  formatDateKey,
  groupSectionDay,
  isWeekendKey,
  sectionStrictDays,
  type AttendanceStatus,
} from "../attendance.js";
import { sectionHeadcounts } from "../enrollment.js";
import { GRADE_NUMERIC, schoolYearClause, type DisplayTerm } from "../../modules/attendance/attendance.repository.js";
import type { HeatSession } from "./heatmaps.grade.service.js";

export interface SectionHeatmapQuery {
  session: HeatSession;
  schoolYearId: string | null;
  displayTerm: DisplayTerm;
}

export async function getSectionHeatmap(query: SectionHeatmapQuery) {
  const { session, schoolYearId, displayTerm } = query;
  const termId = displayTerm.id;

  const sections = await prisma.section.findMany({
    where: schoolYearClause(schoolYearId),
    select: {
      id: true,
      name: true,
      gradeLevel: true,
    },
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
  });

  const headcounts = await sectionHeadcounts(sections.map((s) => s.id));
  const enrolledBySection: Record<string, number> = {};
  for (const s of sections) enrolledBySection[s.id] = headcounts.get(s.id) ?? 0;

  const dayKeys = buildSchoolDayAxis(displayTerm.startDate);
  const schoolDays = countSchoolDays(dayKeys);

  const sectionIds = sections.map((s) => s.id);
  const subjectTakes = await prisma.attendanceRecord.findMany({
    where: { termId, sectionId: { in: sectionIds }, NOT: { subjectId: null } },
    select: {
      sectionId: true,
      studentId: true,
      rosterId: true,
      subjectId: true,
      date: true,
      status: true,
    },
  });

  if (subjectTakes.length === 0) {

    const records = await prisma.attendanceRecord.findMany({
      where: { termId, session },
      select: {
        sectionId: true,
        date: true,
        status: true,
      },
    });

    const dayStatus = groupSectionDay(records);

    const result = sections.map((s) => {
      const statusMap = dayStatus[s.id] ?? new Map();
      const total = enrolledBySection[s.id] ?? 0;
      return {
        sectionId: s.id,
        section: `Grade ${s.name}`,
        gradeLevel: GRADE_NUMERIC[s.gradeLevel] ?? s.gradeLevel,
        enrolled: total,
        days: dayKeys.map((key) => {
          const cell = statusMap.get(key);
          const present = cell?.present ?? 0;
          const late = cell?.late ?? 0;
          const excused = cell?.excused ?? 0;
          const accounted = present + late + excused;
          const absent = Math.max(0, total - accounted);
          return {
            date: formatDateKey(key),
            isoDate: key,
            present,
            late,
            absent,
            excused,
            total,
            isWeekend: isWeekendKey(key),

            ratio: dailyPresentPercent(present, total),
          };
        }),
      };
    });

    return {
      session,
      sections: result,
      schoolDays,
      term: { id: displayTerm.id, termNumber: displayTerm.termNumber },
    };
  }

  const entries = await prisma.sectionTimetableEntry.findMany({
    where: {
      sectionId: { in: sectionIds },
      termId,
      status: { in: ["APPROVED", "SUBMITTED"] },
    },
    select: { sectionId: true, subjectId: true, day: true },
  });
  const strict = sectionStrictDays(
    subjectTakes.map((r) => ({
      sectionId: r.sectionId,
      studentKey: r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string),
      subjectId: r.subjectId as string,
      date: r.date,
      status: r.status as AttendanceStatus,
    })),
    buildOfferedMap(entries)
  );

  const result = sections.map((s) => {
    const total = enrolledBySection[s.id] ?? 0;
    const sectionDays = strict.get(s.id);
    return {
      sectionId: s.id,
      section: `Grade ${s.name}`,
      gradeLevel: GRADE_NUMERIC[s.gradeLevel] ?? s.gradeLevel,
      enrolled: total,
      days: dayKeys.map((key) => {
        const cell = sectionDays?.get(key);
        const present = cell?.present.size ?? 0;
        const late = cell?.late.size ?? 0;
        const excused = cell?.excused.size ?? 0;
        const absent = Math.max(0, total - present - late - excused);
        return {
          date: formatDateKey(key),
          isoDate: key,
          present,
          late,
          absent,
          excused,
          total,
          isWeekend: isWeekendKey(key),

          ratio: dailyPresentPercent(present, total),
        };
      }),
    };
  });

  return {
    session,
    sections: result,
    schoolDays,
    term: { id: displayTerm.id, termNumber: displayTerm.termNumber },
  };
}
