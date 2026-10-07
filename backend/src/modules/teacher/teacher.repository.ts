import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { fanoutNotification } from "../../lib/notify.js";
import { subjectAverageAttendance } from "../../services/attendance.js";

// Shared teacher data-access: labels, empty payloads, schedule-config
// mapping, master-teacher gates, timetable helpers, master fanouts, and the
// advisory roster builder used by the overview + student-list endpoints.
// Endpoint orchestration lives in src/services/teacher/*.service.ts.

export const GRADE_LABELS: Record<string, string> = {
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};

export const COMPONENT_TYPE_LABEL: Record<string, "WW" | "PT" | "E"> = {
  WRITTEN_WORK: "WW",
  PERFORMANCE_TASK: "PT",
  EXAM: "E",
};

export const ACTION_LABEL: Record<string, string> = {
  grade_lock: "Locked grades",
  grade_unlock: "Unlocked grades",
  anecdotal_edit: "Logged anecdotal",
  referral_status_change: "Updated referral",
  create: "Created record",
  update: "Updated record",
};

export function gradeToNumber(gradeLevel: string | number): number {
  if (typeof gradeLevel === "number") return gradeLevel;
  const m = String(gradeLevel).match(/\d+/);
  return m ? Number(m[0]) : 0;
}

export const EMPTY_RESPONSE = {  teacherName: "",
  isAdviser: false,
  isMasterTeacher: false,
  masterTeacherEligible: false,
  masterTeacherTaken: false,
  masterTeacherHolderName: null as string | null,
  advisorySection: null,
  kpi: { classCount: 0, pendingAssessments: 0, openFlags: 0, studentCount: 0 },
  atRiskFactors: { academic: 0, attendance: 0, behavioral: 0 },
  atRiskStudents: 0,
  classes: [],
  classStudents: [],
  recentActivity: [],
  advisory: { students: [] },
  subjectClasses: { assessments: [], standings: [] },
};

export const SCHEDULE_CONFIG_DEFAULTS = {
  startTime: "07:30",
  periodMins: 60,
  lunch: { afterPeriod: 4, mins: 90 },
  morningRecess: { enabled: false, afterPeriod: 2, mins: 15 },
  afternoonRecess: { enabled: false, afterPeriod: 6, mins: 15 },
};

export function toScheduleConfig(row: {
  startTime: string;
  periodMins: number;
  lunchAfter: number;
  lunchMins: number;
  recessAmOn: boolean;
  recessAmAfter: number;
  recessAmMins: number;
  recessPmOn: boolean;
  recessPmAfter: number;
  recessPmMins: number;
}) {
  return {
    startTime: row.startTime,
    periodMins: row.periodMins,
    lunch: { afterPeriod: row.lunchAfter, mins: row.lunchMins },
    morningRecess: { enabled: row.recessAmOn, afterPeriod: row.recessAmAfter, mins: row.recessAmMins },
    afternoonRecess: { enabled: row.recessPmOn, afterPeriod: row.recessPmAfter, mins: row.recessPmMins },
  };
}

export function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return date.toISOString().slice(0, 10);
}

export async function requireMasterTeacher(teacherId: string, action: string) {
  const profile = await prisma.staffProfile.findUnique({ where: { userId: teacherId } });
  if (!profile?.isMasterTeacher) {
    throw new AppError(403, "MASTER_TEACHER_REQUIRED", `Only Master Teachers can ${action}`);
  }
}

export async function resolveScheduleTarget(sectionId: string, subjectId: string | null) {
  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section || !["G7", "G8", "G9", "G10"].includes(section.gradeLevel as string)) {
    throw new AppError(
      403,
      "GRADE_BAND_NOT_ALLOWED",
      "Schedule subject is only available for grades 7–10"
    );
  }
  if (subjectId) {
    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) {
      throw new AppError(404, "SUBJECT_NOT_FOUND", "Subject not found");
    }
    if (subject.gradeLevel !== section.gradeLevel) {
      throw new AppError(
        403,
        "GRADE_MISMATCH",
        "The subject must belong to the section's grade level"
      );
    }
  }
  return section;
}

// One assignment per (teacher, subject, section, term) — created on demand so
// the gradebook/attendance owners resolve for scheduled subjects. Shared with
// the principal review flow (approval is what materializes assignments).
export async function ensureSubjectAssignment(
  teacherId: string,
  subjectId: string,
  sectionId: string,
  termId: string
) {
  const existing = await prisma.teacherSubjectAssignment.findFirst({
    where: { teacherId, subjectId, sectionId, termId },
    select: { id: true },
  });
  if (existing) return existing;
  return prisma.teacherSubjectAssignment.create({
    data: { teacherId, subjectId, sectionId, termId },
    select: { id: true },
  });
}

// Drops the requester's assignment once its last timetable cell is gone.
export async function cleanupOrphanAssignment(
  teacherId: string,
  subjectId: string,
  sectionId: string,
  termId: string
) {
  const remaining = await prisma.sectionTimetableEntry.count({
    where: { sectionId, termId, subjectId },
  });
  if (remaining === 0) {
    await prisma.teacherSubjectAssignment.deleteMany({
      where: { teacherId, subjectId, sectionId, termId },
    });
  }
}

// One subject takes one teacher per section (per term) — a teacher may still
// own several subjects. Shared by the slot writer, the submit gate, and the
// principal approve gate so every timeslot in every section stays consistent.
export async function findSubjectTeacherSplits(
  where: { sectionId?: string; termId: string },
): Promise<
  { subjectId: string; subjectName: string; sectionName: string; teacherNames: string[] }[]
> {
  const rows = await prisma.sectionTimetableEntry.findMany({
    where: { ...where, teacherNameId: { not: null } },
    select: {
      sectionId: true,
      subjectId: true,
      teacherNameId: true,
      subject: { select: { name: true } },
      section: { select: { name: true } },
      teacherName: { select: { name: true } },
    },
  });
  const bySubject = new Map<
    string,
    { subjectId: string; subjectName: string; sectionName: string; teachers: Map<string, string> }
  >();
  for (const r of rows) {
    if (!r.teacherNameId) continue;
    // Group per section + subject: the same subject in another section may
    // legitimately have a different teacher.
    const key = `${r.sectionId}|${r.subjectId}`;
    let bucket = bySubject.get(key);
    if (!bucket) {
      bucket = {
        subjectId: r.subjectId,
        subjectName: r.subject?.name ?? "Subject",
        sectionName: r.section?.name ?? "section",
        teachers: new Map(),
      };
      bySubject.set(key, bucket);
    }
    bucket.teachers.set(r.teacherNameId, r.teacherName?.name ?? "another teacher");
  }
  return [...bySubject.values()]
    .filter((b) => b.teachers.size > 1)
    .map((b) => ({
      subjectId: b.subjectId,
      subjectName: b.subjectName,
      sectionName: b.sectionName,
      teacherNames: [...b.teachers.values()],
    }));
}

// Best-effort fanout to active Master Teachers (never delays responses).
// Masters are flagged on StaffProfile, not a role, so role fanout can't
// address them.
export async function notifyMastersScheduleChanged(reason: string, excludeUserId?: string) {
  try {
    const masters = await prisma.user.findMany({
      where: { status: "active", staffProfile: { isMasterTeacher: true } },
      select: { id: true },
    });
    await Promise.all(
      masters
        .filter((m) => m.id !== excludeUserId)
        .map((m) =>
          fanoutNotification({
            userId: m.id,
            sourceTable: "section_timetable_entries",
            action: "schedule_update",
            message: reason,
          })
        )
    );
  } catch {
    // Logged inside fanoutNotification; never throws outward.
  }
}

export async function notifyMastersTeacherLinkChanged(
  teacherNameId: string,
  teacherName: string,
  code: string | null,
  action: "claim" | "unclaim"
) {
  try {
    const masters = await prisma.user.findMany({
      where: { status: "active", staffProfile: { isMasterTeacher: true } },
      select: { id: true },
    });
    const message =
      action === "claim"
        ? `${teacherName} linked code ${code ?? "—"} to their login — their classes now follow the scheduled timetable.`
        : `${teacherName} unlinked code ${code ?? "—"} from their login.`;
    await Promise.all(
      masters.map((m) =>
        fanoutNotification({
          userId: m.id,
          sourceTable: "teacher_names",
          action,
          sourceId: teacherNameId,
          message,
        })
      )
    );
  } catch {
    // Logged inside fanoutNotification; never throws outward.
  }
}

// Advisory roster for the student list (adviser mode): every advisee in the
// section — registered profiles plus enlisted roster-only rows
// (LRN-deduped) — in the SAME row shape as subject mode. Attendance % is the
// per-subject average over elapsed meetups (the advisory attendance
// definition: 0% once meetups elapsed with no takes, blank only when nothing
// elapsed); present/total use the section-wide elapsed total (summed across
// all offered subjects — ONE shared denominator for every student, never
// each student's own takes count); the academic grade is the general average
// (mean transmuted grade) across the section's offered subjects this term.
export async function advisoryRoster(termId: string, sectionId: string) {
  const [profiles, rosterEntries, assignSubs, entrySubs] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { sectionId },
      select: { userId: true, lrn: true, user: { select: { fullName: true } } },
      orderBy: { user: { fullName: "asc" } },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId },
      select: { id: true, lrn: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.teacherSubjectAssignment.findMany({
      where: { sectionId, termId },
      select: { subjectId: true },
      distinct: ["subjectId"],
    }),
    prisma.sectionTimetableEntry.findMany({
      where: { sectionId, termId, status: { in: ["APPROVED", "SUBMITTED"] } },
      select: { subjectId: true, day: true },
    }),
  ]);
  const offeredIds = [
    ...new Set([...assignSubs.map((s) => s.subjectId), ...entrySubs.map((s) => s.subjectId)]),
  ];
  const registeredLrns = new Set(profiles.map((p) => p.lrn));
  const rosterOnly = rosterEntries.filter((r) => !registeredLrns.has(r.lrn));
  const profileIds = profiles.map((p) => p.userId);
  const rosterIds = rosterOnly.map((r) => r.id);
  const keyOf = (studentId: string | null, rosterId: string | null): string | null =>
    studentId ?? (rosterId ? `roster:${rosterId}` : null);

  const [profileFinals, rosterFinals, takes, avgs, term] = await Promise.all([
    profileIds.length > 0 && offeredIds.length > 0
      ? prisma.finalGrade.findMany({
          where: { termId, subjectId: { in: offeredIds }, studentId: { in: profileIds } },
          select: { studentId: true, computedAverage: true, transmutedGrade: true },
        })
      : Promise.resolve([] as { studentId: string | null; computedAverage: number | null; transmutedGrade: number | null }[]),
    rosterIds.length > 0 && offeredIds.length > 0
      ? prisma.finalGrade.findMany({
          where: { termId, subjectId: { in: offeredIds }, rosterId: { in: rosterIds } },
          select: { rosterId: true, computedAverage: true, transmutedGrade: true },
        })
      : Promise.resolve([] as { rosterId: string | null; computedAverage: number | null; transmutedGrade: number | null }[]),
    offeredIds.length > 0
      ? prisma.attendanceRecord.findMany({
          where: { termId, sectionId, subjectId: { in: offeredIds } },
          select: { studentId: true, rosterId: true, subjectId: true, status: true, date: true },
        })
      : Promise.resolve([] as { studentId: string | null; rosterId: string | null; subjectId: string | null; status: string; date: Date }[]),
    subjectAverageAttendance([sectionId], termId),
    prisma.term.findUnique({
      where: { id: termId },
      select: { startDate: true, endDate: true },
    }),
  ]);

  const finalsByKey = new Map<string, { computedAverage: number | null; transmutedGrade: number | null }[]>();
  for (const f of profileFinals) {
    const key = keyOf(f.studentId, null);
    if (!key) continue;
    const arr = finalsByKey.get(key) ?? [];
    arr.push({ computedAverage: f.computedAverage, transmutedGrade: f.transmutedGrade });
    finalsByKey.set(key, arr);
  }
  for (const f of rosterFinals) {
    const key = keyOf(null, f.rosterId);
    if (!key) continue;
    const arr = finalsByKey.get(key) ?? [];
    arr.push({ computedAverage: f.computedAverage, transmutedGrade: f.transmutedGrade });
    finalsByKey.set(key, arr);
  }
  // Section-wide elapsed meetups: meetup weekdays per offered subject from
  // committed slots × term start → today (same window as the advisory
  // attendance matrix). The summed total is ONE shared denominator for
  // every student — never each student's own takes count. Presents are
  // distinct present dates per subject inside the window (matrix unit).
  const meetupDays = new Map<string, Set<number>>();
  for (const e of entrySubs) {
    const set = meetupDays.get(e.subjectId) ?? new Set<number>();
    set.add(e.day);
    meetupDays.set(e.subjectId, set);
  }
  const startStr = term?.startDate?.toISOString().slice(0, 10) ?? null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const termEndStr = term?.endDate?.toISOString().slice(0, 10) ?? null;
  const endStr = termEndStr && termEndStr < todayStr ? termEndStr : todayStr;
  const elapsedBySubject = new Map<string, Set<string>>();
  if (startStr && startStr <= endStr && offeredIds.length > 0) {
    for (const sid of offeredIds) {
      const days = meetupDays.get(sid) ?? new Set([1, 2, 3, 4, 5]);
      const set = new Set<string>();
      for (
        let d = new Date(`${startStr}T00:00:00Z`);
        d.toISOString().slice(0, 10) <= endStr;
        d = new Date(d.getTime() + 86_400_000)
      ) {
        const dow = d.getUTCDay();
        const day = dow === 0 ? 7 : dow;
        if (days.has(day)) set.add(d.toISOString().slice(0, 10));
      }
      if (set.size > 0) elapsedBySubject.set(sid, set);
    }
  }
  const sectionMeetups = [...elapsedBySubject.values()].reduce((n, s) => n + s.size, 0);
  const presentDays = new Map<string, Set<string>>();
  for (const t of takes) {
    if (t.status !== "present") continue;
    const key = keyOf(t.studentId, t.rosterId);
    if (!key || !t.subjectId) continue;
    const dayKey = t.date.toISOString().slice(0, 10);
    if (!elapsedBySubject.get(t.subjectId)?.has(dayKey)) continue;
    const cellKey = `${key}|${t.subjectId}`;
    const set = presentDays.get(cellKey) ?? new Set<string>();
    set.add(dayKey);
    presentDays.set(cellKey, set);
  }
  const presentByKey = new Map<string, number>();
  for (const [cellKey, dates] of presentDays) {
    const key = cellKey.slice(0, cellKey.lastIndexOf("|"));
    presentByKey.set(key, (presentByKey.get(key) ?? 0) + dates.size);
  }

  const r1 = (n: number) => Math.round(n * 10) / 10;
  const mean = (ns: (number | null)[]): number | null => {
    const vals = ns.filter((n): n is number => n !== null);
    return vals.length > 0 ? r1(vals.reduce((s, n) => s + n, 0) / vals.length) : null;
  };

  return [
    ...profiles.map((p) => ({
      studentId: p.userId,
      name: p.user.fullName,
      lrn: p.lrn,
      hasAccount: true as const,
    })),
    ...rosterOnly.map((r) => ({
      studentId: `roster:${r.id}`,
      name: r.fullName,
      lrn: r.lrn,
      hasAccount: false as const,
    })),
  ]
    .map((s) => {
      const avg = avgs.get(s.studentId)?.average ?? null;
      const finals = finalsByKey.get(s.studentId) ?? [];
      return {
        ...s,
        attendancePresent: presentByKey.get(s.studentId) ?? 0,
        attendanceTotal: sectionMeetups,
        attendancePercentage: avg === null ? null : Math.round(avg * 1000) / 10,
        computedAverage: mean(finals.map((f) => f.computedAverage)),
        academicGrade: mean(finals.map((f) => f.transmutedGrade)),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
