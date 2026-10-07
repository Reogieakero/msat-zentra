import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { invalidateTags } from "../../lib/cache.js";
import { fanoutNotification } from "../../lib/notify.js";
import {
  adviserSectionsOr404,
  teachableSectionIds,
} from "../../modules/teacher/advisory.repository.js";
import type { AdvisoryContext } from "./advisory.types.js";

export interface EnlistInput {
  fullName: string;
  lrn: string;
  sectionId?: string;
}

// POST /api/teacher/advisory/roster — enlist a student into the adviser's
// section roster (enrolled, no login account yet). When the student later
// registers with the same LRN, the registrar's breakdown links them.
// Adviser-only (404 otherwise).
export async function enlistRoster(
  ctx: AdvisoryContext,
  input: EnlistInput,
  yearId: string | null,
) {
  const teacherId = ctx.userId;
  // Enlistments are saved under the session's active School Year — and
  // the advisership gate is scoped to that same year.
  if (!yearId) {
    throw new AppError(409, "NO_ACTIVE_YEAR", "No active school year");
  }
  const sections = await adviserSectionsOr404(teacherId, yearId);
  const section = input.sectionId
    ? sections.find((s) => s.id === input.sectionId)
    : sections[0];
  if (!section) {
    throw new AppError(404, "SECTION_NOT_FOUND", "Section is not in your advisory");
  }

  const existing = await prisma.studentRoster.findUnique({
    where: { lrn_schoolYearId: { lrn: input.lrn, schoolYearId: yearId } },
  });
  if (existing) {
    throw new AppError(409, "LRN_ENLISTED", "This LRN is already enlisted");
  }
  const alreadyRegistered = await prisma.studentProfile.findUnique({
    where: { lrn: input.lrn },
    select: { userId: true },
  });
  if (alreadyRegistered) {
    throw new AppError(409, "LRN_REGISTERED", "This LRN already has an account");
  }

  const entry = await prisma.studentRoster.create({
    data: {
      lrn: input.lrn,
      fullName: input.fullName,
      gradeLevel: section.gradeLevel,
      sectionId: section.id,
      schoolYearId: yearId,
    },
    include: { section: { select: { name: true } } },
  });

  // Audit, cache invalidation, and the bell fanout all run behind the
  // response so enlisting feels instant — the service returns the payload
  // and the route responds first.
  const response = {
    studentId: `roster:${entry.id}`,
    name: entry.fullName,
    lrn: entry.lrn,
    birthdate: null,
    gender: null,
    section: entry.section.name,
    riskLevel: "Low",
    flags: [],
    attendanceRate: 1,
    anecdotalCount: 0,
    confidentialityTiers: [],
    hasOpenFlag: false,
    openFlagCount: 0,
    hasAccount: false,
  };
  void (async () => {
    try {
      await writeAudit({
        userId: teacherId,
        actionType: "create",
        sourceTable: "student_roster",
        sourceId: entry.id,
        reason: `Enlisted ${entry.fullName} (${entry.lrn}) to ${entry.section.name}`,
      });
      // Enrollment headcounts are cached — a new enlistment must refresh
      // academics, overview, and teacher caches immediately.
      await invalidateTags([
        "registrar",
        "record-keeper",
        "academics",
        "overview",
        "principal",
        "teacher",
      ]);
      // Realtime bell row for the filing adviser (toast suppressed
      // client-side — the success toast already fired there).
      await fanoutNotification({
        userId: teacherId,
        sourceTable: "student_roster",
        action: "create_self",
        message: `You enlisted ${entry.fullName} (${entry.lrn}) to ${entry.section.name}.`,
        sourceId: entry.id,
      });
    } catch {
      // Logged inside fanoutNotification/audit; never throws outward.
    }
  })();
  return response;
}

export interface AttendanceSheetQuery {
  sectionId?: string;
  subjectId?: string;
  slot: number;
  session: string;
  date: Date;
  schoolYearId: string | null;
}

// GET /api/teacher/advisory/attendance — submitted marks for one section +
// date (+ subject & slot) — per-subject sheet prefill.
//
// Subject path (subjectId present) filters by (section, subject, day, slot);
// legacy path filters by session. Without sectionId the scope stays the
// caller's teachable sections (advisory UNION assignments UNION code-linked
// timetable sections); with sectionId the scope narrows to that section
// (403 unless teachable), so two sections sharing a subject never mix marks.
export async function getAttendanceSheet(ctx: AdvisoryContext, query: AttendanceSheetQuery) {
  const teacherId = ctx.userId;
  // Advisory UNION assignments UNION code-linked timetable sections, so
  // claimed subject teachers prefill their own classes too.
  const teachable = await teachableSectionIds(
    teacherId,
    null,
    query.schoolYearId,
  );
  if (teachable.length === 0) {
    throw new AppError(404, "NOT_ADVISER", "No advisory or teaching sections assigned");
  }
  const { sectionId: onlySection, subjectId, slot, session, date } = query;
  if (onlySection && !teachable.includes(onlySection)) {
    throw new AppError(403, "FORBIDDEN", "Section is not in your teaching load");
  }
  const sectionIds = onlySection ? [onlySection] : teachable;
  if (!subjectId && session !== "AM" && session !== "PM") {
    throw new AppError(400, "BAD_SESSION", "session must be AM or PM");
  }
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, "BAD_DATE", "date must be an ISO datetime");
  }
  const dayKey = date.toISOString().slice(0, 10);
  const dayStart = new Date(`${dayKey}T00:00:00Z`);
  const nextDay = new Date(dayStart.getTime() + 86_400_000);
  // Day-bounded match covers both UTC-midnight rows (new takes) and
  // local-noon rows (seed backfill) falling on the same UTC calendar day.
  const records = await prisma.attendanceRecord.findMany({
    where: {
      sectionId: { in: sectionIds },
      ...(subjectId
        ? { subjectId, slot }
        : { session: session as "AM" | "PM" }),
      date: { gte: dayStart, lt: nextDay },
    },
    select: { studentId: true, rosterId: true, status: true, subjectId: true, slot: true },
  });
  return {
    date: dayKey,
    ...(subjectId ? { subjectId, slot } : { session }),
    marks: records.map((r) => ({
      studentId: r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string),
      status: r.status,
    })),
  };
}

