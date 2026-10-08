import { prisma } from "../../lib/prisma.js";

export interface LegacyDaysQuery {
  sectionId?: string;
  session: "AM" | "PM";
  limit: number;
}

export async function getLegacyDays(query: LegacyDaysQuery) {
  const { sectionId, session, limit } = query;
  const rows = await prisma.attendanceRecordLegacy.findMany({
    where: { ...(sectionId ? { sectionId } : {}), session },
    orderBy: { date: "desc" },
    take: limit,
    select: { id: true, studentId: true, rosterId: true, sectionId: true, date: true, session: true, status: true, termId: true },
  });
  return { session, sectionId: sectionId ?? null, source: "legacy", rows };
}
