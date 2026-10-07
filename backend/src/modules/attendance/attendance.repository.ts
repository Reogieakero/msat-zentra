import type { Request } from "express";
import { prisma } from "../../lib/prisma.js";
import { manilaKey } from "../../services/attendance.js";

// Shared attendance data-access: grade labels, Philippines-day helpers,
// display-term resolution, and the school-year where-clause used by the
// section reads. Endpoint orchestration lives in
// src/services/attendance/*.service.ts.

export const GRADE_ORDER = ["G7", "G8", "G9", "G10", "G11", "G12"] as const;

export const GRADE_LABEL: Record<string, string> = {
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};

export const GRADE_NUMERIC: Record<string, string> = {
  G7: "7",
  G8: "8",
  G9: "9",
  G10: "10",
  G11: "11",
  G12: "12",
};

// Philippines calendar day (school operates on local time).
export function phDayKey(d: Date): string {
  return new Date(d.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

export function phWeekday(dayKey: string): number {
  return new Date(`${dayKey}T00:00:00Z`).getUTCDay();
}

// Monday (PH) starting the week containing the given PH day key.
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

// Display term for heatblocks: the session's active term when the request
// carries one (Login → select → scope); otherwise the term whose
// [startDate, endDate] contains today (Manila), falling back to Term 1 when
// nothing matches (e.g. dates unset) so legacy behavior is preserved.
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

// Section scoping for the session's active school year (same rule as
// schoolYearWhere in lib/termScope, without taking the request).
export function schoolYearClause(schoolYearId: string | null):
  | { schoolYearId: string }
  | { schoolYear: { isActive: boolean } } {
  return schoolYearId ? { schoolYearId } : { schoolYear: { isActive: true } };
}
