import { prisma } from "../lib/prisma.js";

export interface AttendanceRate {
  rate: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  isRisk: boolean;
}

// PLAN.md §6.2 — rate over AM/PM sessions in a term.
export async function computeAttendanceRate(
  studentId: string,
  termId: string
): Promise<AttendanceRate> {
  const records = await prisma.attendanceRecord.findMany({
    where: { studentId, termId },
    select: { status: true },
  });
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const r of records) counts[r.status]++;
  const total = records.length;
  const rate = total === 0 ? 1 : counts.present / total;
  return {
    ...counts,
    total,
    rate,
    isRisk: rate < 0.8,
  };
}
