import { prisma } from "../../lib/prisma.js";
import {
  computeRiskFactors,
  evaluateRisk,
  evaluateRosterRisk,
  levelFromFlags,
  resolveActiveTermId,
} from "../../services/risk.js";
import { sectionHeadcounts } from "../../services/enrollment.js";
import type { Request } from "express";

export async function getBatchLevels(
  rawIds: unknown,
  role: string,
  userId: string,
  req: Request,
) {
  const raw = rawIds;
  const list = Array.isArray(raw)
    ? raw.flatMap((v) => String(v).split(","))
    : String(raw ?? "").split(",");
  const ids = [...new Set(list.map((s) => s.trim()).filter(Boolean))].slice(0, 100);
  if (ids.length === 0) return { levels: {}, factors: {} };

  const isPrincipal = role === "principal";
  const isStaff = ["adviser", "guidance_counselor", "nurse", "adm_coordinator"].includes(role);
  if (!isPrincipal && !isStaff) {
    const err = { status: 403, code: "FORBIDDEN", message: "Limited view only" };
    throw err;
  }

  const [profiles, rosters] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { userId: { in: ids } },
      select: {
        userId: true,
        riskLevel: true,
        section: { select: { id: true, adviserId: true } },
      },
    }),
    prisma.studentRoster.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        sectionId: true,
        section: { select: { adviserId: true } },
      },
    }),
  ]);

  const levels: Record<string, string> = {};

  const factors: Record<string, { Academic: boolean; Attendance: boolean; Behavioral: boolean }> = {};
  const rosterIds: string[] = [];
  const rosterSection = new Map<string, string>();
  const visibleProfiles = profiles.filter(
    (p) =>
      !(
        role === "adviser" &&
        userId !== p.userId &&
        p.section?.adviserId !== userId
      ),
  );
  // Real-time: levels filled from live compute below (not stored riskLevel).
  for (const r of rosters) {
    if (role === "adviser" && r.section?.adviserId !== userId) continue;
    rosterIds.push(r.id);
    if (r.sectionId) rosterSection.set(r.id, r.sectionId);
  }

  const profileIds = visibleProfiles.map((p) => p.userId);
  if (profileIds.length > 0) {
    const termId = await resolveActiveTermId(req);
    if (termId) {
      const profileRows = await prisma.studentProfile.findMany({
        where: { userId: { in: profileIds } },
        select: {
          userId: true,
          section: { select: { id: true } },
          finalGrades: {
            where: { termId },
            select: { computedAverage: true, transmutedGrade: true },
          },
          attendanceRecords: {
            where: { termId },
            select: { status: true, subjectId: true },
          },
          anecdotalRecords: { where: { termId }, select: { id: true } },
        },
      });
      const pSectionIds = [
        ...new Set(
          profileRows.map((r) => r.section?.id).filter((v): v is string => !!v),
        ),
      ];
      const pHeadcounts = await sectionHeadcounts(pSectionIds);
      for (const pr of profileRows) {
        const enrolled = pHeadcounts.get(pr.section?.id ?? "") ?? 0;
        const flags = computeRiskFactors({
          finalGrades: pr.finalGrades,
          attendance: pr.attendanceRecords.map((a) => ({
            status: a.status,
            subjectId: a.subjectId,
          })),
          anecdotalCount: pr.anecdotalRecords.length,
          enrolled,
        });
        factors[pr.userId] = {
          Academic: flags.academicFlag,
          Attendance: flags.attendanceFlag,
          Behavioral: flags.behavioralFlag,
        };
        levels[pr.userId] = levelFromFlags(flags);
      }
    }
  }
  if (rosterIds.length > 0) {
    const termId = await resolveActiveTermId(req);
    if (termId) {
      const [grades, attendance, anecdotalGroups, headcounts] = await Promise.all([
        prisma.finalGrade.findMany({
          where: { rosterId: { in: rosterIds }, termId },
          select: { rosterId: true, computedAverage: true, transmutedGrade: true },
        }),
        prisma.attendanceRecord.findMany({
          where: { rosterId: { in: rosterIds }, termId },
          select: { rosterId: true, status: true, subjectId: true },
        }),
        prisma.anecdotalRecord.groupBy({
          by: ["rosterId"],
          where: { rosterId: { in: rosterIds }, termId },
          _count: { _all: true },
        }),
        sectionHeadcounts([...new Set(rosterSection.values())]),
      ]);
      const gradesBy = new Map<string, { computedAverage: number | null; transmutedGrade: number | null }[]>();
      for (const g of grades) {
        if (!g.rosterId) continue;
        const arr = gradesBy.get(g.rosterId) ?? [];
        arr.push({ computedAverage: g.computedAverage, transmutedGrade: g.transmutedGrade });
        gradesBy.set(g.rosterId, arr);
      }
      const attBy = new Map<string, { status: string; subjectId: string | null }[]>();
      for (const a of attendance) {
        if (!a.rosterId) continue;
        const arr = attBy.get(a.rosterId) ?? [];
        arr.push({ status: a.status, subjectId: a.subjectId });
        attBy.set(a.rosterId, arr);
      }
      const anecBy = new Map<string, number>();
      for (const g of anecdotalGroups) {
        if (g.rosterId) anecBy.set(g.rosterId, g._count._all);
      }
      for (const rid of rosterIds) {
        const sectionId = rosterSection.get(rid);
        const enrolled = sectionId ? (headcounts.get(sectionId) ?? 0) : 0;
        const flags = computeRiskFactors({
          finalGrades: gradesBy.get(rid) ?? [],
          attendance: attBy.get(rid) ?? [],
          anecdotalCount: anecBy.get(rid) ?? 0,
          enrolled,
        });
        levels[rid] = levelFromFlags(flags);
        factors[rid] = {
          Academic: flags.academicFlag,
          Attendance: flags.attendanceFlag,
          Behavioral: flags.behavioralFlag,
        };
      }
    }
  }
  return { levels, factors };
}

export async function getSingleStudentLevel(
  id: string,
  role: string,
  userId: string,
  req: Request,
) {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: id },
    select: { lrn: true },
  });
  if (!profile) {

    const roster = await prisma.studentRoster.findUnique({
      where: { id },
      select: {
        id: true,
        lrn: true,
        section: { select: { adviserId: true } },
      },
    });
    if (!roster) {
      const err = { status: 404, code: "NOT_FOUND", message: "Student not found" };
      throw err;
    }
    const isPrincipal = role === "principal";
    const isStaff = ["adviser", "guidance_counselor", "nurse", "adm_coordinator"].includes(role);
    if (!isPrincipal && !isStaff) {
      const err = { status: 403, code: "FORBIDDEN", message: "Limited view only" };
      throw err;
    }
    if (role === "adviser" && roster.section?.adviserId !== userId) {
      const err = { status: 403, code: "FORBIDDEN", message: "Not your advisee" };
      throw err;
    }
    const termId = await resolveActiveTermId(req);
    if (!termId) {
      const err = { status: 404, code: "NO_ACTIVE_TERM", message: "No active term" };
      throw err;
    }
    const { result } = await evaluateRosterRisk(roster.id, termId);
    return { lrn: roster.lrn, riskLevel: result.riskLevel };
  }
  const isSelf = userId === id;
  const isPrincipal = role === "principal";
  const isStaff = ["adviser", "guidance_counselor", "nurse", "adm_coordinator"].includes(role);
  if (!isSelf && !isPrincipal && !isStaff) {
    const err = { status: 403, code: "FORBIDDEN", message: "Limited view only" };
    throw err;
  }

  if (role === "adviser" && !isSelf && !isPrincipal) {
    const advisee = await prisma.studentProfile.findUnique({
      where: { userId: id },
      select: { section: { select: { adviserId: true } } },
    });
    if (!advisee || advisee.section?.adviserId !== userId) {
      const err = { status: 403, code: "FORBIDDEN", message: "Not your advisee" };
      throw err;
    }
  }
  // Real-time unified: compute live instead of returning stored riskLevel.
  const termId = await resolveActiveTermId(req);
  if (!termId) {
    const err = { status: 404, code: "NO_ACTIVE_TERM", message: "No active term" };
    throw err;
  }
  const { result } = await evaluateRisk(id, termId);
  return { lrn: profile.lrn, riskLevel: result.riskLevel };
}

export async function getSectionFactorCounts(sectionId: string, termId: string) {
  const students = await prisma.studentProfile.findMany({
    where: { sectionId },
    select: { userId: true },
  });
  const ids = students.map((s) => s.userId);
  const [anecdotals, finals, attendance] = await Promise.all([
    prisma.anecdotalRecord.groupBy({ by: ["studentId"], where: { sectionId, termId }, _count: true }),
    prisma.finalGrade.findMany({
      where: { studentId: { in: ids }, termId },
      select: { studentId: true, computedAverage: true, transmutedGrade: true },
    }),
    prisma.attendanceRecord.findMany({ where: { sectionId, termId }, select: { studentId: true, status: true } }),
  ]);
  const factors = { attendance: 0, grades: 0, behavior: 0, wellbeing: 0 };

  factors.behavior = anecdotals.length;

  // Unified EITHER rule.
  const lowGradeStudents = new Set(
    finals
      .filter((f) => (f.transmutedGrade ?? 100) < 75 || (f.computedAverage ?? 100) < 75)
      .map((f) => f.studentId),
  );
  factors.grades = lowGradeStudents.size;

  const enrolled = students.length;
  const attByStudent = new Map<string, { present: number }>();
  for (const a of attendance) {

    if (!a.studentId) continue;
    const cur = attByStudent.get(a.studentId) ?? { present: 0 };
    if (a.status === "present") cur.present++;
    attByStudent.set(a.studentId, cur);
  }
  for (const [, v] of attByStudent) if (enrolled > 0 && v.present / enrolled < 0.8) factors.attendance++;
  return { sectionId, termId, factors };
}
