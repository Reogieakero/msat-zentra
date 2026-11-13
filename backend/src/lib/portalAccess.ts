import { prisma } from "./prisma.js";
import { AppError } from "./errors.js";
import type { AuthUser } from "../middleware/auth.js";

/**
 * Learner-facing portal access (student + parent).
 *
 * Students may only read their own record; parents may only read a child they
 * have an approved `ParentStudentLink` to. Portal routes never use the adviser
 * `shareStudentData` gate — a learner's own data is always visible to them.
 */

export interface PortalLearner {
  studentId: string;
  lrn: string;
  name: string;
  mascot: string | null;
  photoUrl: string | null;
  gradeLevel: string;
  sectionId: string | null;
  sectionName: string | null;
  adviserName: string | null;
}

export async function loadPortalLearner(studentId: string): Promise<PortalLearner> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
    select: {
      userId: true,
      lrn: true,
      mascot: true,
      photoUrl: true,
      gradeLevel: true,
      sectionId: true,
      user: { select: { fullName: true } },
      section: {
        select: {
          name: true,
          adviser: { select: { fullName: true } },
        },
      },
    },
  });
  if (!profile) {
    throw new AppError(404, "STUDENT_NOT_FOUND", "No learner profile was found for this account");
  }
  return {
    studentId: profile.userId,
    lrn: profile.lrn,
    name: profile.user.fullName,
    mascot: profile.mascot,
    photoUrl: profile.photoUrl,
    gradeLevel: profile.gradeLevel,
    sectionId: profile.sectionId,
    sectionName: profile.section?.name ?? null,
    adviserName: profile.section?.adviser?.fullName ?? null,
  };
}

/** Throws 403 unless the caller owns (student) or is a linked parent of the learner. */
export async function assertLearnerAccess(user: AuthUser, studentId: string): Promise<void> {
  if (user.role === "student") {
    if (user.id === studentId) return;
    throw new AppError(403, "FORBIDDEN", "You can only view your own record");
  }
  if (user.role === "parent") {
    const link = await prisma.parentStudentLink.findUnique({
      where: { parentId_studentId: { parentId: user.id, studentId } },
      select: { approvedBy: true },
    });
    if (link?.approvedBy) return;
    throw new AppError(403, "FORBIDDEN", "This learner is not linked to your account");
  }
  throw new AppError(403, "FORBIDDEN", "Portal access requires a student or parent account");
}

export async function listLinkedChildren(parentId: string) {
  const links = await prisma.parentStudentLink.findMany({
    where: { parentId, approvedBy: { not: null } },
    orderBy: { createdAt: "asc" },
    select: {
      relationship: true,
      student: {
        select: {
          userId: true,
          lrn: true,
          gradeLevel: true,
          mascot: true,
          photoUrl: true,
          section: { select: { id: true, name: true } },
          user: { select: { fullName: true } },
        },
      },
    },
  });
  return links.map((l) => ({
    studentId: l.student.userId,
    name: l.student.user.fullName,
    lrn: l.student.lrn,
    gradeLevel: l.student.gradeLevel,
    mascot: l.student.mascot,
    photoUrl: l.student.photoUrl,
    sectionId: l.student.section?.id ?? null,
    sectionName: l.student.section?.name ?? null,
    relationship: l.relationship,
  }));
}

export interface PortalTerm {
  id: string;
  termNumber: number;
  schoolYearId: string;
  schoolYearName: string;
  startDate: string | null;
  endDate: string | null;
}

/**
 * Resolve the term a portal request is asking for. Students/parents are not
 * term-steering roles, so this accepts an explicit, validated `termId` query
 * param (for historical browsing) and otherwise falls back to the active term.
 */
export async function resolvePortalTerm(
  termId: string | undefined,
  fallbackTermId: string | null,
): Promise<PortalTerm> {
  const wanted = termId?.trim() || fallbackTermId;
  if (!wanted) {
    throw new AppError(409, "NO_ACTIVE_TERM", "No active school year/term is configured");
  }
  const term = await prisma.term.findUnique({
    where: { id: wanted },
    select: {
      id: true,
      termNumber: true,
      startDate: true,
      endDate: true,
      schoolYear: { select: { id: true, name: true } },
    },
  });
  if (!term) {
    throw new AppError(404, "TERM_NOT_FOUND", "That school term does not exist");
  }
  return {
    id: term.id,
    termNumber: term.termNumber,
    schoolYearId: term.schoolYear.id,
    schoolYearName: term.schoolYear.name,
    startDate: term.startDate?.toISOString() ?? null,
    endDate: term.endDate?.toISOString() ?? null,
  };
}

/**
 * Section the learner belonged to in a given term. Current profile is the
 * fallback; historical terms resolve from that term's attendance rows first,
 * then from the learner's roster entry for that school year.
 */
export async function learnerSectionForTerm(
  studentId: string,
  term: PortalTerm,
): Promise<string | null> {
  const attendance = await prisma.attendanceRecord.findFirst({
    where: { studentId, termId: term.id },
    select: { sectionId: true },
    orderBy: { date: "desc" },
  });
  if (attendance?.sectionId) return attendance.sectionId;

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
    select: { lrn: true, sectionId: true, section: { select: { schoolYearId: true } } },
  });
  if (!profile) return null;
  const roster = await prisma.studentRoster.findFirst({
    where: { lrn: profile.lrn, schoolYearId: term.schoolYearId },
    select: { sectionId: true },
  });
  return roster?.sectionId ??
    (profile.section?.schoolYearId === term.schoolYearId ? profile.sectionId : null);
}

/** Terms the learner has final grades or attendance for, newest first. */
export async function listLearnerTerms(
  studentId: string,
  activeTermId: string | null,
): Promise<PortalTerm[]> {
  const [gradeRows, attendanceRows] = await Promise.all([
    prisma.finalGrade.groupBy({ by: ["termId"], where: { studentId } }),
    prisma.attendanceRecord.groupBy({ by: ["termId"], where: { studentId } }),
  ]);
  const ids = new Set<string>();
  for (const r of gradeRows) ids.add(r.termId);
  for (const r of attendanceRows) ids.add(r.termId);
  if (activeTermId) ids.add(activeTermId);
  if (ids.size === 0) return [];

  const terms = await prisma.term.findMany({
    where: { id: { in: [...ids] } },
    select: {
      id: true,
      termNumber: true,
      startDate: true,
      endDate: true,
      schoolYear: { select: { id: true, name: true, startDate: true } },
    },
  });
  return terms
    .sort((a, b) => {
      const ay = a.schoolYear.startDate?.getTime() ?? 0;
      const by = b.schoolYear.startDate?.getTime() ?? 0;
      if (by !== ay) return by - ay;
      return b.termNumber - a.termNumber;
    })
    .map((t) => ({
      id: t.id,
      termNumber: t.termNumber,
      schoolYearId: t.schoolYear.id,
      schoolYearName: t.schoolYear.name,
      startDate: t.startDate?.toISOString() ?? null,
      endDate: t.endDate?.toISOString() ?? null,
    }));
}
