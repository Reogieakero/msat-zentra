import type { Request } from "express";
import { prisma } from "./prisma.js";

export interface TermScope {
  schoolYearId: string;
  schoolYearName: string;
  termId: string;
  termNumber: number;
  startDate: string | null;
  endDate: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      termScope?: TermScope;
    }
  }
}

function single(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const first = value.find((v) => typeof v === "string" && (v as string).trim());
    return typeof first === "string" ? first.trim() : undefined;
  }
  return undefined;
}

function header(req: Request, name: string): string | undefined {
  return single(req.headers[name]);
}

export async function resolveTermScope(req: Request): Promise<TermScope | null> {
  const qYear = single((req.query as Record<string, unknown>).schoolYearId);
  const qTerm = single((req.query as Record<string, unknown>).termId);
  const hYear = header(req, "x-school-year-id");
  const hTerm = header(req, "x-term-id");

  const termId = qTerm ?? hTerm;
  const yearId = qYear ?? hYear;

  if (termId) {
    const term = await prisma.term.findUnique({
      where: { id: termId },
      select: {
        id: true,
        termNumber: true,
        startDate: true,
        endDate: true,
        schoolYearId: true,
        schoolYear: { select: { id: true, name: true } },
      },
    });
    if (term?.schoolYear) {
      return {
        schoolYearId: term.schoolYear.id,
        schoolYearName: term.schoolYear.name,
        termId: term.id,
        termNumber: term.termNumber,
        startDate: term.startDate?.toISOString() ?? null,
        endDate: term.endDate?.toISOString() ?? null,
      };
    }
  }

  if (yearId) {
    const year = await prisma.schoolYear.findUnique({
      where: { id: yearId },
      select: {
        id: true,
        name: true,
        terms: {
          orderBy: { termNumber: "asc" },
          select: { id: true, termNumber: true, startDate: true, endDate: true },
        },
      },
    });
    const first = year ? pickCurrentTerm(year.terms) : null;
    if (year && first) {
      return {
        schoolYearId: year.id,
        schoolYearName: year.name,
        termId: first.id,
        termNumber: first.termNumber,
        startDate: first.startDate?.toISOString() ?? null,
        endDate: first.endDate?.toISOString() ?? null,
      };
    }
  }

  const activeYear = await prisma.schoolYear.findFirst({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      terms: {
        orderBy: { termNumber: "asc" },
        select: { id: true, termNumber: true, startDate: true, endDate: true },
      },
    },
  });
  const fallback = activeYear ? pickCurrentTerm(activeYear.terms) : null;
  if (activeYear && fallback) {
    return {
      schoolYearId: activeYear.id,
      schoolYearName: activeYear.name,
      termId: fallback.id,
      termNumber: fallback.termNumber,
      startDate: fallback.startDate?.toISOString() ?? null,
      endDate: fallback.endDate?.toISOString() ?? null,
    };
  }

  return null;
}

export function getTermScope(req: Request): TermScope | null {
  return req.termScope ?? null;
}

interface TermDateRow {
  startDate: Date | null;
  endDate: Date | null;
}

export function pickCurrentTerm<T extends TermDateRow>(terms: T[]): T | null {
  if (terms.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  const day = (d: Date | null, fallback: string) =>
    d ? d.toISOString().slice(0, 10) : fallback;
  return (
    terms.find(
      (t) => day(t.startDate, "0000-01-01") <= today && today <= day(t.endDate, "9999-12-31"),
    ) ?? terms[0]!
  );
}

export interface TermScopeInput {
  schoolYearId?: string | null;
  termId?: string | null;
}

export function scopedTermId(req: Request): string | null {
  return req.termScope?.termId ?? null;
}

export function scopedSchoolYearId(req: Request): string | null {
  return req.termScope?.schoolYearId ?? null;
}

export function schoolYearWhere(
  req: Request,
): { schoolYearId: string } | { schoolYear: { isActive: boolean } } {
  const id = req.termScope?.schoolYearId;
  return id ? { schoolYearId: id } : { schoolYear: { isActive: true } };
}

export interface ScopedTermRow {
  id: string;
  termNumber: number;
  startDate: Date | null;
  endDate: Date | null;
  schoolYearId: string | null;
  schoolYearName: string | null;
}

export async function scopedTermRow(req: Request): Promise<ScopedTermRow | null> {
  const s = req.termScope;
  if (s) {
    return {
      id: s.termId,
      termNumber: s.termNumber,
      startDate: s.startDate ? new Date(s.startDate) : null,
      endDate: s.endDate ? new Date(s.endDate) : null,
      schoolYearId: s.schoolYearId,
      schoolYearName: s.schoolYearName,
    };
  }
  const candidates = await prisma.term.findMany({
    where: { schoolYear: { isActive: true } },
    orderBy: { termNumber: "asc" },
    select: {
      id: true,
      termNumber: true,
      startDate: true,
      endDate: true,
      schoolYearId: true,
      schoolYear: { select: { name: true } },
    },
  });
  const t = pickCurrentTerm(candidates);
  return t
    ? {
        id: t.id,
        termNumber: t.termNumber,
        startDate: t.startDate,
        endDate: t.endDate,
        schoolYearId: t.schoolYearId,
        schoolYearName: t.schoolYear.name,
      }
    : null;
}

export async function scopedYearId(req: Request): Promise<string | null> {
  if (req.termScope) return req.termScope.schoolYearId;
  const y = await prisma.schoolYear.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  return y?.id ?? null;
}
