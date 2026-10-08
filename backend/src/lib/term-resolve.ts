import type { Request } from "express";
import { prisma } from "./prisma.js";
import { pickCurrentTerm } from "./termScope.js";

export async function resolveActiveTermId(
  req?: { termScope?: { termId: string } | undefined } | Request,
): Promise<string | null> {
  const scoped = (req as { termScope?: { termId: string } } | undefined)?.termScope?.termId;
  if (scoped) return scoped;
  const terms = await prisma.term.findMany({
    where: { schoolYear: { isActive: true } },
    orderBy: { termNumber: "asc" },
    select: { id: true, startDate: true, endDate: true },
  });
  return pickCurrentTerm(terms)?.id ?? null;
}
