import { prisma } from "../lib/prisma.js";
import { resolveActiveTermId as resolveActiveTermIdCore } from "../lib/term-resolve.js";
import { sectionHeadcounts } from "./enrollment.js";
import { notifyInterventionDetected } from "../lib/notify.js";
import type { RiskLevel } from "../generated/prisma/client.js";

export const resolveActiveTermId = resolveActiveTermIdCore;

export interface RiskResult {
  riskCount: number;
  riskLevel: RiskLevel;
}

function flagsFromParts(args: {
  grades: RiskGrade[];
  mode?: GradeMode;
  attendance: { status: string; subjectId: string | null }[];
  /** Section-wide term meetups — see `sectionAttendanceTotals`. */
  attendanceTotal?: number;
  anecdotalCount: number;
  enrolled: number;
}): { academicFlag: boolean; attendanceFlag: boolean; behavioralFlag: boolean; result: RiskResult } {
  // Real-time unified rule: EITHER average < 75 flags academic.
  // gradeMode is ignored (kept for backwards compat).
  const finalAvg =
    args.grades.length > 0
      ? args.grades.reduce((s, g) => s + (g.transmutedGrade ?? 0), 0) / args.grades.length
      : null;
  const rawAvg =
    args.grades.length > 0
      ? args.grades.reduce((s, g) => s + (g.computedAverage ?? 0), 0) / args.grades.length
      : null;
  const academicFlag =
    (finalAvg != null && finalAvg < 75) || (rawAvg != null && rawAvg < 75);

  const attPresent = args.attendance.filter((a) => a.status === "present").length;
  // Denominator: the section's meetups for the whole term when supplied, so a
  // learner added mid-term is rated from the term's first meetup (their
  // pre-enrolment days count as missed) instead of from their first mark.
  const attTotal = Math.max(args.attendanceTotal ?? 0, args.attendance.length);
  // No attendance signal at all — never treat an empty record set as 0%.
  const attendanceFlag =
    attTotal === 0
      ? false
      : args.attendance.some((a) => a.subjectId !== null)
        ? attPresent / attTotal < 0.8
        : args.enrolled > 0
          ? attPresent / args.enrolled < 0.8
          : false;

  const behavioralFlag = args.anecdotalCount >= 1;

  const riskCount = (academicFlag ? 1 : 0) + (attendanceFlag ? 1 : 0) + (behavioralFlag ? 1 : 0);
  const riskLevel: RiskLevel = riskCount >= 2 ? "High" : riskCount === 1 ? "Moderate" : "Low";

  return { academicFlag, attendanceFlag, behavioralFlag, result: { riskCount, riskLevel } };
}

/**
 * Elapsed class meetups per section for a term, anchored at the TERM START
 * DATE — not at the date a learner was added. The risk engine and the
 * principal hover card share this denominator so classmates always read the
 * same /N.
 *
 * Meetups come from the published timetable (one per scheduled subject/day
 * from term start up to today or term end). Sections without a published
 * timetable fall back to the distinct attendance sheets actually recorded,
 * and we never report fewer meetups than were recorded.
 */
export async function sectionAttendanceTotals(
  sectionIds: string[],
  termId: string,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const ids = Array.from(new Set(sectionIds.filter((id): id is string => !!id)));
  if (ids.length === 0) return out;

  const [term, entries, sheets] = await Promise.all([
    prisma.term.findUnique({
      where: { id: termId },
      select: { startDate: true, endDate: true },
    }),
    prisma.sectionTimetableEntry.findMany({
      where: {
        sectionId: { in: ids },
        termId,
        status: { in: ["APPROVED", "SUBMITTED"] },
      },
      select: { sectionId: true, subjectId: true, day: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { sectionId: { in: ids }, termId },
      select: { sectionId: true, date: true, subjectId: true, slot: true, session: true },
    }),
  ]);

  // Recorded sheets per section act as a floor: one meetup is one
  // subject-slot sheet, or a legacy AM/PM session.
  const recordedBySection = new Map<string, Set<string>>();
  for (const s of sheets) {
    const day = s.date.toISOString().slice(0, 10);
    const key = s.subjectId ? `${day}|${s.subjectId}|${s.slot}` : `${day}|legacy|${s.session}`;
    const set = recordedBySection.get(s.sectionId) ?? new Set<string>();
    set.add(key);
    recordedBySection.set(s.sectionId, set);
  }

  const daysBySectionSubject = new Map<string, Set<number>>();
  for (const e of entries) {
    const key = `${e.sectionId}|${e.subjectId}`;
    const set = daysBySectionSubject.get(key) ?? new Set<number>();
    set.add(e.day);
    daysBySectionSubject.set(key, set);
  }

  const startStr = term?.startDate?.toISOString().slice(0, 10) ?? null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const endStr = (() => {
    if (!term?.endDate) return todayStr;
    const termEnd = term.endDate.toISOString().slice(0, 10);
    return termEnd < todayStr ? termEnd : todayStr;
  })();

  for (const sectionId of ids) {
    let meetups = 0;
    if (startStr && startStr <= endStr) {
      for (const [key, days] of daysBySectionSubject) {
        if (!key.startsWith(`${sectionId}|`)) continue;
        for (
          let d = new Date(`${startStr}T00:00:00Z`);
          d.toISOString().slice(0, 10) <= endStr;
          d = new Date(d.getTime() + 86_400_000)
        ) {
          const dow = d.getUTCDay();
          const day = dow === 0 ? 7 : dow;
          if (days.has(day)) meetups += 1;
        }
      }
    }
    out.set(sectionId, Math.max(meetups, recordedBySection.get(sectionId)?.size ?? 0));
  }
  return out;
}

export async function evaluateRisk(
  studentId: string,
  termId: string,
  _gradeMode?: GradeMode,
): Promise<{ academicFlag: boolean; attendanceFlag: boolean; behavioralFlag: boolean; result: RiskResult }> {
  const [finalGrades, attendance, anecdotals, profile] = await Promise.all([
    prisma.finalGrade.findMany({
      where: { studentId, termId },
      select: { computedAverage: true, transmutedGrade: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { studentId, termId },
      select: { status: true, subjectId: true },
    }),
    prisma.anecdotalRecord.count({ where: { studentId, termId } }),
    prisma.studentProfile.findUnique({
      where: { userId: studentId },
      select: {
        sectionId: true,
        section: { select: { _count: { select: { students: true } } } },
      },
    }),
  ]);
  const sectionId = profile?.sectionId ?? null;
  const totals = sectionId
    ? await sectionAttendanceTotals([sectionId], termId)
    : new Map<string, number>();

  return flagsFromParts({
    grades: finalGrades,
    attendance,
    attendanceTotal: sectionId ? totals.get(sectionId) : undefined,
    anecdotalCount: anecdotals,
    enrolled: profile?.section?._count.students ?? 0,
  });
}

export interface DualRisk {
  raw: RiskResult;
  final: RiskResult;
  rawFlags: { academicFlag: boolean; attendanceFlag: boolean; behavioralFlag: boolean };
  finalFlags: { academicFlag: boolean; attendanceFlag: boolean; behavioralFlag: boolean };
}

export async function evaluateBothRisk(
  studentId: string,
  termId: string,
): Promise<DualRisk> {
  const [finalGrades, attendance, anecdotals, profile] = await Promise.all([
    prisma.finalGrade.findMany({
      where: { studentId, termId },
      select: { computedAverage: true, transmutedGrade: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { studentId, termId },
      select: { status: true, subjectId: true },
    }),
    prisma.anecdotalRecord.count({ where: { studentId, termId } }),
    prisma.studentProfile.findUnique({
      where: { userId: studentId },
      select: {
        sectionId: true,
        section: { select: { _count: { select: { students: true } } } },
      },
    }),
  ]);
  const sectionId = profile?.sectionId ?? null;
  const totals = sectionId
    ? await sectionAttendanceTotals([sectionId], termId)
    : new Map<string, number>();
  const parts = {
    grades: finalGrades,
    attendance,
    attendanceTotal: sectionId ? totals.get(sectionId) : undefined,
    anecdotalCount: anecdotals,
    enrolled: profile?.section?._count.students ?? 0,
  };
  const rawFull = flagsFromParts({ ...parts });
  const finalFull = flagsFromParts({ ...parts });
  return {
    raw: rawFull.result,
    final: finalFull.result,
    rawFlags: {
      academicFlag: rawFull.academicFlag,
      attendanceFlag: rawFull.attendanceFlag,
      behavioralFlag: rawFull.behavioralFlag,
    },
    finalFlags: {
      academicFlag: finalFull.academicFlag,
      attendanceFlag: finalFull.attendanceFlag,
      behavioralFlag: finalFull.behavioralFlag,
    },
  };
}

export interface RiskFactors {
  academicFlag: boolean;
  attendanceFlag: boolean;
  behavioralFlag: boolean;
}

// Deprecated: gradeMode is ignored — all views are real-time unified.
// Kept for backwards compat with callers that still pass it.
export type GradeMode = "raw" | "final";

export interface RiskGrade {
  computedAverage: number | null;
  transmutedGrade: number | null;
}

export interface FactorInputs {
  finalGrades: RiskGrade[];

  rawAverages?: number[];

  gradeMode?: GradeMode;

  attendance: { status: string; subjectId?: string | null }[];

  /**
   * Section meetups for the whole term (term start → now). When supplied it
   * replaces the learner's own mark count as the attendance denominator, so
   * classmates — including anyone added mid-term — all read the same /N.
   * Build it with `sectionAttendanceTotals`.
   */
  attendanceTotal?: number;

  anecdotalCount: number;

  enrolled: number;
}

export function computeRiskFactors(inputs: FactorInputs): RiskFactors {
  const { finalGrades, rawAverages = [], attendance, anecdotalCount, enrolled } = inputs;
  // Unified real-time rule: EITHER average < 75.
  const finalAvgFromGrades =
    finalGrades.length > 0
      ? finalGrades.reduce((s, g) => s + (g.transmutedGrade ?? 0), 0) / finalGrades.length
      : null;
  const rawAvgFromGrades =
    finalGrades.length > 0
      ? finalGrades.reduce((s, g) => s + (g.computedAverage ?? 0), 0) / finalGrades.length
      : null;
  const rawAvg =
    rawAverages.length > 0
      ? rawAverages.reduce((s, v) => s + v, 0) / rawAverages.length
      : rawAvgFromGrades;
  const academicFlag =
    (finalAvgFromGrades != null && finalAvgFromGrades < 75) ||
    (rawAvg != null && rawAvg < 75);
  const attPresent = attendance.filter((a) => a.status === "present").length;

  // Denominator: the section's term-wide meetups when the caller supplied
  // them (a late enrollee then starts at the term's first meetup), otherwise
  // the learner's own marks. No marks at all still means no signal.
  const attTotal = Math.max(inputs.attendanceTotal ?? 0, attendance.length);
  const subjectEra = attendance.some((a) => a.subjectId != null) || attendance.length === 0;
  const attendanceFlag =
    attTotal === 0
      ? false
      : subjectEra
        ? attPresent / attTotal < 0.8
        : enrolled > 0
          ? attPresent / enrolled < 0.8
          : false;
  const behavioralFlag = anecdotalCount >= 1;
  return { academicFlag, attendanceFlag, behavioralFlag };
}

export function levelFromFlags(flags: RiskFactors): RiskLevel {
  const riskCount =
    (flags.academicFlag ? 1 : 0) +
    (flags.attendanceFlag ? 1 : 0) +
    (flags.behavioralFlag ? 1 : 0);
  return riskCount >= 2 ? "High" : riskCount === 1 ? "Moderate" : "Low";
}

export function isAtRisk(level: RiskLevel): boolean {
  return level === "High" || level === "Moderate";
}

export async function evaluateRosterRisk(
  rosterId: string,
  termId: string,
  _gradeMode?: GradeMode,
): Promise<{ academicFlag: boolean; attendanceFlag: boolean; behavioralFlag: boolean; result: RiskResult }> {
  const [finalGrades, attendance, anecdotals, roster] = await Promise.all([
    prisma.finalGrade.findMany({
      where: { rosterId, termId },
      select: { computedAverage: true, transmutedGrade: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { rosterId, termId },
      select: { status: true, subjectId: true },
    }),
    prisma.anecdotalRecord.count({ where: { rosterId, termId } }),
    prisma.studentRoster.findUnique({
      where: { id: rosterId },
      select: { sectionId: true },
    }),
  ]);

  const enrolled = roster
    ? ((await sectionHeadcounts([roster.sectionId])).get(roster.sectionId) ?? 0)
    : 0;
  const totals = roster
    ? await sectionAttendanceTotals([roster.sectionId], termId)
    : new Map<string, number>();

  return flagsFromParts({
    grades: finalGrades,
    attendance,
    attendanceTotal: roster ? totals.get(roster.sectionId) : undefined,
    anecdotalCount: anecdotals,
    enrolled,
  });
}

export async function evaluateBothRosterRisk(
  rosterId: string,
  termId: string,
): Promise<DualRisk> {
  const [finalGrades, attendance, anecdotals, roster] = await Promise.all([
    prisma.finalGrade.findMany({
      where: { rosterId, termId },
      select: { computedAverage: true, transmutedGrade: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { rosterId, termId },
      select: { status: true, subjectId: true },
    }),
    prisma.anecdotalRecord.count({ where: { rosterId, termId } }),
    prisma.studentRoster.findUnique({
      where: { id: rosterId },
      select: { sectionId: true },
    }),
  ]);
  const enrolled = roster
    ? ((await sectionHeadcounts([roster.sectionId])).get(roster.sectionId) ?? 0)
    : 0;
  const totals = roster
    ? await sectionAttendanceTotals([roster.sectionId], termId)
    : new Map<string, number>();
  const parts = {
    grades: finalGrades,
    attendance,
    attendanceTotal: roster ? totals.get(roster.sectionId) : undefined,
    anecdotalCount: anecdotals,
    enrolled,
  };
  const rawFull = flagsFromParts({ ...parts });
  const finalFull = flagsFromParts({ ...parts });
  return {
    raw: rawFull.result,
    final: finalFull.result,
    rawFlags: {
      academicFlag: rawFull.academicFlag,
      attendanceFlag: rawFull.attendanceFlag,
      behavioralFlag: rawFull.behavioralFlag,
    },
    finalFlags: {
      academicFlag: finalFull.academicFlag,
      attendanceFlag: finalFull.attendanceFlag,
      behavioralFlag: finalFull.behavioralFlag,
    },
  };
}

/**
 * Auto-detection gate: the engine only raises a Guidance intervention when the
 * learner's class adviser has connected/synced student data in Settings —
 * i.e. the adviser has claimed the section and switched sharing ON.
 */
export async function isAdviserDataConnected(args: {
  studentId?: string | null;
  rosterId?: string | null;
}): Promise<boolean> {
  if (!!args.studentId === !!args.rosterId) return false;
  const select = {
    section: {
      select: {
        adviser: {
          select: { staffProfile: { select: { shareStudentData: true } } },
        },
      },
    },
  };
  const row = args.studentId
    ? await prisma.studentProfile.findUnique({
        where: { userId: args.studentId },
        select,
      })
    : await prisma.studentRoster.findUnique({
        where: { id: args.rosterId! },
        select,
      });
  return row?.section?.adviser?.staffProfile?.shareStudentData ?? false;
}

export async function recomputeRisk(studentId: string, termId: string) {
  const dual = await evaluateBothRisk(studentId, termId);
  const result = dual.final;

  // Real-time engine contract: only react when a factor actually changed.
  // Recomputing on every write must not re-snapshot or re-detect an unchanged
  // learner (that produced duplicate snapshots and repeat detections).
  const current = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
    select: {
      academicFlag: true,
      attendanceFlag: true,
      behavioralFlag: true,
    },
  });
  const flagsChanged =
    !current ||
    current.academicFlag !== dual.finalFlags.academicFlag ||
    current.attendanceFlag !== dual.finalFlags.attendanceFlag ||
    current.behavioralFlag !== dual.finalFlags.behavioralFlag;
  // A NEW factor = a flag that was false (or unknown) and is now true.
  const newFactor =
    !current ||
    (dual.finalFlags.academicFlag && !current.academicFlag) ||
    (dual.finalFlags.attendanceFlag && !current.attendanceFlag) ||
    (dual.finalFlags.behavioralFlag && !current.behavioralFlag);

  if (!flagsChanged) return result;

  await prisma.$transaction([
    prisma.studentProfile.update({
      where: { userId: studentId },
      data: {
        riskCount: result.riskCount,
        riskLevel: result.riskLevel,
        academicFlag: dual.finalFlags.academicFlag,
        attendanceFlag: dual.finalFlags.attendanceFlag,
        behavioralFlag: dual.finalFlags.behavioralFlag,
      },
    }),
    prisma.riskSnapshot.create({
      data: {
        studentId,
        riskLevel: result.riskLevel,
        riskLevelRaw: dual.raw.riskLevel,
        riskLevelFinal: result.riskLevel,
        academicFlag: dual.finalFlags.academicFlag,
        attendanceFlag: dual.finalFlags.attendanceFlag,
        behavioralFlag: dual.finalFlags.behavioralFlag,
        academicFlagRaw: dual.rawFlags.academicFlag,
        attendanceFlagRaw: dual.rawFlags.attendanceFlag,
        behavioralFlagRaw: dual.rawFlags.behavioralFlag,
        riskCount: result.riskCount,
        termId,
      },
    }),
  ]);

  const atRisk = result.riskLevel === "High" || result.riskLevel === "Moderate";
  if (atRisk && newFactor && (await isAdviserDataConnected({ studentId }))) {
    const open = await prisma.intervention.findFirst({
      where: { studentId, termId, outcomeStatus: { not: "resolved" }, approvalStatus: { not: "rejected" } },
      select: { id: true },
    });
    if (!open) {
      const guidance = await prisma.user.findFirst({
        where: { role: "guidance_counselor", status: "active" },
        select: { id: true },
      });
      if (guidance) {
        const created = await prisma.intervention.create({
          data: {
            studentId,
            termId,
            riskLevelAtFlag: result.riskLevel,
            recommendedAction: "Auto-flagged at-risk student — assigned to Guidance Counselor for follow-up.",
            assignedTo: guidance.id,
            assignedAt: new Date(),
            approvalStatus: "approved",
            outcomeStatus: "ongoing",
          },
        });

        void notifyInterventionDetected({
          level: result.riskLevel,
          interventionId: created.id,
          studentId,
        });
      }
    }
  }
  return result;
}

export async function recomputeRosterRisk(rosterId: string, termId: string) {
  const dual = await evaluateBothRosterRisk(rosterId, termId);
  const result = dual.final;

  // Same contract as `recomputeRisk`: an unchanged learner is not re-snapshotted
  // and not re-detected. Only a newly-triggered factor raises an intervention.
  const current = await prisma.studentRoster.findUnique({
    where: { id: rosterId },
    select: {
      academicFlag: true,
      attendanceFlag: true,
      behavioralFlag: true,
    },
  });
  const flagsChanged =
    !current ||
    current.academicFlag !== dual.finalFlags.academicFlag ||
    current.attendanceFlag !== dual.finalFlags.attendanceFlag ||
    current.behavioralFlag !== dual.finalFlags.behavioralFlag;
  const newFactor =
    !current ||
    (dual.finalFlags.academicFlag && !current.academicFlag) ||
    (dual.finalFlags.attendanceFlag && !current.attendanceFlag) ||
    (dual.finalFlags.behavioralFlag && !current.behavioralFlag);

  if (!flagsChanged) return result;

  await prisma.$transaction([
    prisma.studentRoster.update({
      where: { id: rosterId },
      data: {
        riskCount: result.riskCount,
        riskLevel: result.riskLevel,
        academicFlag: dual.finalFlags.academicFlag,
        attendanceFlag: dual.finalFlags.attendanceFlag,
        behavioralFlag: dual.finalFlags.behavioralFlag,
      },
    }),
    prisma.riskSnapshot.create({
      data: {
        studentId: null,
        rosterId,
        riskLevel: result.riskLevel,
        riskLevelRaw: dual.raw.riskLevel,
        riskLevelFinal: result.riskLevel,
        academicFlag: dual.finalFlags.academicFlag,
        attendanceFlag: dual.finalFlags.attendanceFlag,
        behavioralFlag: dual.finalFlags.behavioralFlag,
        academicFlagRaw: dual.rawFlags.academicFlag,
        attendanceFlagRaw: dual.rawFlags.attendanceFlag,
        behavioralFlagRaw: dual.rawFlags.behavioralFlag,
        riskCount: result.riskCount,
        termId,
      },
    }),
  ]);

  const atRisk = result.riskLevel === "High" || result.riskLevel === "Moderate";
  if (atRisk && newFactor && (await isAdviserDataConnected({ rosterId }))) {
    const open = await prisma.intervention.findFirst({
      where: { rosterId, termId, outcomeStatus: { not: "resolved" }, approvalStatus: { not: "rejected" } },
      select: { id: true },
    });
    if (!open) {
      const guidance = await prisma.user.findFirst({
        where: { role: "guidance_counselor", status: "active" },
        select: { id: true },
      });
      if (guidance) {
        const created = await prisma.intervention.create({
          data: {
            studentId: null,
            rosterId,
            termId,
            riskLevelAtFlag: result.riskLevel,
            recommendedAction: "Auto-flagged at-risk student — assigned to Guidance Counselor for follow-up.",
            assignedTo: guidance.id,
            assignedAt: new Date(),
            approvalStatus: "approved",
            outcomeStatus: "ongoing",
          },
        });

        void notifyInterventionDetected({
          level: result.riskLevel,
          interventionId: created.id,
          rosterId,
        });
      }
    }
  }
  return result;
}
