import { prisma } from "../../lib/prisma.js";

export interface FlagRow {
  id: string;
  reason: string;
  note: string | null;
  status: string;
  ownerId: string | null;
  createdAt: Date;
  escalatedAt: Date | null;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  student: { userId: string; lrn: string; user: { fullName: string } };
  subject: { id: string; name: string };
  section: { id: string; name: string };
  term: { id: string; termNumber: number };
  raisedByUser: { id: string; fullName: string };
  owner: { id: string; fullName: string } | null;
  resolvedByUser: { id: string; fullName: string } | null;
}

export function serializeFlag(f: FlagRow) {
  const ageDays = Math.floor((Date.now() - f.createdAt.getTime()) / 86_400_000);
  return {
    id: f.id,
    reason: f.reason,
    note: f.note,
    status: f.status,
    ageDays,
    createdAt: f.createdAt,
    escalatedAt: f.escalatedAt,
    resolvedAt: f.resolvedAt,
    resolutionNote: f.resolutionNote,
    student: { id: f.student.userId, name: f.student.user.fullName, lrn: f.student.lrn },
    subject: { id: f.subject.id, name: f.subject.name },
    section: { id: f.section.id, name: f.section.name },
    term: { id: f.term.id, termNumber: f.term.termNumber },
    raisedBy: f.raisedByUser,
    owner: f.owner,
  };
}

export function flagInclude() {
  return {
    student: { select: { userId: true, lrn: true, user: { select: { fullName: true } } } },
    subject: { select: { id: true, name: true } },
    section: { select: { id: true, name: true } },
    term: { select: { id: true, termNumber: true } },
    raisedByUser: { select: { id: true, fullName: true } },
    owner: { select: { id: true, fullName: true } },
    resolvedByUser: { select: { id: true, fullName: true } },
  } as const;
}

export async function teacherScope(teacherId: string) {
  const [assignments, advised] = await Promise.all([
    prisma.teacherSubjectAssignment.findMany({
      where: { teacherId },
      select: { subjectId: true, sectionId: true, termId: true },
    }),
    prisma.section.findMany({
      where: { adviserId: teacherId },
      select: { id: true },
    }),
  ]);
  const assignedSectionIds = Array.from(new Set(assignments.map((a) => a.sectionId)));
  const advisedSectionIds = advised.map((s) => s.id);
  return { assignments, assignedSectionIds, advisedSectionIds };
}
