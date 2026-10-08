import type { Request } from "express";
import { prisma } from "../../lib/prisma.js";
import { manilaKey } from "../../services/attendance.js";
import { GRADE_LABELS as GRADE_LABEL, GRADE_ORDER } from "../../lib/grades.js";

export { GRADE_LABEL, GRADE_ORDER };

export const GRADE_NUMERIC: Record<string, string> = {
  G7: "7",
  G8: "8",
  G9: "9",
  G10: "10",
  G11: "11",
  G12: "12",
};

export function phDayKey(d: Date): string {
  return new Date(d.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

export function phWeekday(dayKey: string): number {
  return new Date(`${dayKey}T00:00:00Z`).getUTCDay();
}

export function mondayOf(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * 86_400_000).toISOString().slice(0, 10);
}

export interface DisplayTerm {
  id: string;
  termNumber: number;
  startDate: Date | null;
}

export async function resolveDisplayTerm(req?: Request): Promise<DisplayTerm | null> {
  if (req?.termScope) {
    const s = req.termScope;
    return {
      id: s.termId,
      termNumber: s.termNumber,
      startDate: s.startDate ? new Date(s.startDate) : null,
    };
  }
  const terms = await prisma.term.findMany({
    where: { schoolYear: { isActive: true } },
    orderBy: { termNumber: "asc" },
    select: { id: true, termNumber: true, startDate: true, endDate: true },
  });
  if (terms.length === 0) return null;
  const today = manilaKey(new Date());
  const current = terms.find((t) => {
    const s = t.startDate ? manilaKey(t.startDate) : null;
    const e = t.endDate ? manilaKey(t.endDate) : null;
    return (!s || s <= today) && (!e || today <= e);
  });
  const hit = current ?? terms[0]!;
  return { id: hit.id, termNumber: hit.termNumber, startDate: hit.startDate };
}

export function schoolYearClause(schoolYearId: string | null):
  | { schoolYearId: string }
  | { schoolYear: { isActive: boolean } } {
  return schoolYearId ? { schoolYearId } : { schoolYear: { isActive: true } };
}
