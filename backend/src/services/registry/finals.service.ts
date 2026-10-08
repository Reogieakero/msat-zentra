import { prisma } from "../../lib/prisma.js";
import type { RegistryContext } from "./registry.types.js";

export interface FinalsQuery {
  page: number;
  pageSize: number;
  q: string;
}

export async function listFinalGrades(ctx: RegistryContext, query: FinalsQuery) {
  const band = ctx.band;
  const { page, pageSize, q } = query;

  const rows = await prisma.finalGrade.findMany({
    where: {
      OR: [
        { student: { gradeLevel: { in: band } } },
        { roster: { gradeLevel: { in: band } } },
      ],
    },
    select: {
      id: true,
      lockStatus: true,
      computedAverage: true,
      transmutedGrade: true,
      remarks: true,
      subjectId: true,
      termId: true,
      student: {
        select: {
          lrn: true,
          gradeLevel: true,
          sectionId: true,
          section: { select: { name: true } },
          user: { select: { fullName: true } },
        },
      },
      roster: {
        select: {
          lrn: true,
          fullName: true,
          gradeLevel: true,
          sectionId: true,
          section: { select: { name: true } },
        },
      },
      subject: { select: { name: true } },
      term: { select: { id: true, termNumber: true, schoolYear: { select: { name: true } } } },
    },
    orderBy: [{ termId: "asc" }, { student: { user: { fullName: "asc" } } }, { subject: { name: "asc" } }],
  });

  const lrnOf = (r: (typeof rows)[number]) => r.student?.lrn ?? r.roster?.lrn ?? "";
  const nameOf = (r: (typeof rows)[number]) =>
    r.student?.user.fullName ?? r.roster?.fullName ?? "";
  const sectionIdOf = (r: (typeof rows)[number]) =>
    r.student?.sectionId ?? r.roster?.sectionId ?? "";

  const teacherKeys = new Set<string>();
  const teacherTermIds = new Set<string>();
  for (const r of rows) {
    const sectionId = sectionIdOf(r);
    teacherTermIds.add(r.termId);
    if (sectionId) teacherKeys.add(`${r.subjectId}|${sectionId}|${r.termId}`);
  }
  const teacherAssignments = await prisma.teacherSubjectAssignment.findMany({
    where: { termId: { in: [...teacherTermIds] } },
    select: {
      subjectId: true,
      sectionId: true,
      termId: true,
      teacher: { select: { fullName: true } },
    },
  });
  const teacherMap = new Map<string, string>();
  for (const ta of teacherAssignments) {
    const key = `${ta.subjectId}|${ta.sectionId}|${ta.termId}`;
    if (teacherKeys.has(key)) teacherMap.set(key, ta.teacher.fullName);
  }

  const byKey = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${lrnOf(r)}|${r.term.id}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(r);
  }

  const viewableGroups: (typeof rows)[] = [];
  for (const group of byKey.values()) {
    if (group.length > 0 && group.every((r) => r.lockStatus === "adviser_approved")) {
      viewableGroups.push(group);
    }
  }

  viewableGroups.sort((a, b) => nameOf(a[0]).localeCompare(nameOf(b[0])));

  const matchedGroups = q
    ? viewableGroups.filter((group) => {
        const r0 = group[0];
        const sectionName =
          r0.student?.section?.name ?? r0.roster?.section?.name ?? "";
        return (
          nameOf(r0).toLowerCase().includes(q) ||
          lrnOf(r0).toLowerCase().includes(q) ||
          sectionName.toLowerCase().includes(q) ||
          group.some((r) => r.subject.name.toLowerCase().includes(q))
        );
      })
    : viewableGroups;

  const totalStudents = matchedGroups.length;
  const totalPages = Math.max(1, Math.ceil(totalStudents / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const slice = matchedGroups.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  const readyCount = viewableGroups.reduce((sum, g) => sum + g.length, 0);
  const completeCount = viewableGroups.length;
  const lockedCount = rows.filter((r) => r.lockStatus === "locked").length;
  const adviserApprovedCount = rows.filter((r) => r.lockStatus === "adviser_approved").length;

  const students = slice.map((group) => {
    const r0 = group[0];
    return {
      id: `${lrnOf(r0)}|${r0.term.id}`,
      lrn: lrnOf(r0),
      name: nameOf(r0),
      gradeLevel: r0.student?.gradeLevel ?? r0.roster?.gradeLevel ?? "",
      section: r0.student?.section?.name ?? r0.roster?.section?.name ?? "—",
      hasAccount: r0.student != null,
      term: `${r0.term.schoolYear.name.split(" ")[0]} T${r0.term.termNumber}`,
      overall: Math.round(
        (group.reduce((sum, r) => sum + (r.transmutedGrade ?? 0), 0) / group.length) * 100
      ) / 100,
      subjects: group.map((r) => {
        const teacherKey = `${r.subjectId}|${sectionIdOf(r)}|${r.termId}`;
        return {
          id: r.id,
          subject: r.subject.name,
          teacher: teacherMap.get(teacherKey) ?? "—",
          computedAverage: r.computedAverage ?? 0,
          transmutedGrade: r.transmutedGrade ?? 0,
          remarks: r.remarks ?? "—",
          status: "approved" as const,
        };
      }),
      status: "approved" as const,
    };
  });

  return {
    students,
    total: totalStudents,
    ready: readyCount,
    complete: completeCount,
    locked: lockedCount,
    adviserApproved: adviserApprovedCount,
    page: clampedPage,
    pageSize,
  };
}
