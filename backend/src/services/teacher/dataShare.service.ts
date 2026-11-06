import { prisma } from "../../lib/prisma.js";

export const BYPASS_SHARE_ROLES = new Set([
  "principal",
  "registrar",
  "record_keeper",
]);

export function canBypassSharing(role: string, requesterId: string | null, ownerIds: string[]): boolean {
  if (!requesterId) return false;
  if (ownerIds.includes(requesterId)) return true;
  return BYPASS_SHARE_ROLES.has(role);
}

export async function isSharing(teacherId: string): Promise<boolean> {
  const row = await prisma.staffProfile.findUnique({
    where: { userId: teacherId },
    select: { shareStudentData: true },
  });
  return row?.shareStudentData ?? false;
}

export async function sharingMap(teacherIds: string[]): Promise<Map<string, boolean>> {
  const uniq = [...new Set(teacherIds.filter(Boolean))];
  if (uniq.length === 0) return new Map();
  const rows = await prisma.staffProfile.findMany({
    where: { userId: { in: uniq } },
    select: { userId: true, shareStudentData: true },
  });
  const map = new Map<string, boolean>(uniq.map((id) => [id, false]));
  for (const r of rows) map.set(r.userId, r.shareStudentData);
  return map;
}

export async function resolveGradeOwnerIds(
  subjectId: string,
  sectionId: string,
  termId: string,
): Promise<string[]> {
  const [assignments, links] = await Promise.all([
    prisma.teacherSubjectAssignment.findMany({
      where: { subjectId, sectionId, termId },
      select: { teacherId: true },
    }),
    prisma.sectionTimetableEntry.findMany({
      where: {
        subjectId,
        sectionId,
        termId,
        status: { in: ["SUBMITTED", "APPROVED"] },
        teacherName: { userId: { not: null } },
      },
      select: { teacherName: { select: { userId: true } } },
    }),
  ]);
  const ids = new Set<string>();
  for (const a of assignments) if (a.teacherId) ids.add(a.teacherId);
  for (const l of links) {
    const uid = l.teacherName?.userId;
    if (uid) ids.add(uid);
  }
  return [...ids];
}

export async function resolveAttendanceOwnerId(record: {
  assignmentId?: string | null;
  recordedBy?: string | null;
}): Promise<string | null> {
  if (record.assignmentId) {
    const row = await prisma.teacherSubjectAssignment.findUnique({
      where: { id: record.assignmentId },
      select: { teacherId: true },
    });
    if (row?.teacherId) return row.teacherId;
  }
  return record.recordedBy ?? null;
}

export async function isGradeVisibleTo(
  subjectId: string,
  sectionId: string,
  termId: string,
  requesterId: string,
  requesterRole: string,
): Promise<{ visible: boolean; ownerIds: string[] }> {
  const ownerIds = await resolveGradeOwnerIds(subjectId, sectionId, termId);
  if (ownerIds.length === 0) return { visible: true, ownerIds };
  if (canBypassSharing(requesterRole, requesterId, ownerIds)) {
    return { visible: true, ownerIds };
  }
  const map = await sharingMap(ownerIds);
  const visible = ownerIds.some((id) => map.get(id) === true);
  return { visible, ownerIds };
}
