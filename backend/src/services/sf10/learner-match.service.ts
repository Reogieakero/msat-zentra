// Roster matching for detected learner identities (pure scoring + prisma search).
// LRN-exact is decisive; name scoring is order-insensitive and initial-tolerant.

import { prisma } from "../../lib/prisma.js";
import { resolveGradeBand } from "../../modules/sf10/sf10.repository.js";
import type { LearnerIdentity } from "./learner-identity.service.js";

export interface RosterCandidate {
  studentId: string;
  lrn: string;
  fullName: string;
  gradeLevel: string;
  section: string;
  /** lrn-exact | name */
  matchKind: string;
  /** 0–100. */
  score: number;
}

function normToken(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function splitName(fullName: string): string[] {
  return fullName.toUpperCase().replace(/[^A-Z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a || !b) return Math.max(a.length, b.length);
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let carry = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, carry + (a[i - 1] === b[j - 1] ? 0 : 1));
      carry = next;
    }
  }
  return prev[b.length];
}

function tokenMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  // Initial tolerance: "A" matches "ANTONIO".
  if (a.length === 1 && b.startsWith(a)) return true;
  if (b.length === 1 && a.startsWith(b)) return true;
  if (Math.abs(a.length - b.length) <= 1 && a.length >= 4 && levenshtein(a, b) <= 1) return true;
  return false;
}

/** Last-name agreement: full token or typo only — initials never suffice. */
function lastTokenMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.abs(a.length - b.length) <= 1 && a.length >= 4 && levenshtein(a, b) <= 1) return true;
  return false;
}

/** 0–100 name score. Last name is required to agree; it carries the weight. */
export function scoreNameMatch(
  identity: Pick<LearnerIdentity, "lastName" | "firstName" | "middleName" | "suffix">,
  rosterFullName: string,
): number {
  if (!identity.lastName && !identity.firstName) return 0;
  const tokens = splitName(rosterFullName);
  if (tokens.length === 0) return 0;
  const idLast = (identity.lastName ?? "").split(/\s+/).map(normToken).filter(Boolean);
  const idFirst = normToken(identity.firstName ?? "");
  const idMiddle = (identity.middleName ?? "").split(/\s+/).map(normToken).filter(Boolean);

  // Last name: every identity token should hit some roster token.
  if (idLast.length > 0) {
    const hits = idLast.filter((t) => tokens.some((r) => lastTokenMatch(t, r)));
    if (hits.length === 0) return 0;
    if (hits.length < idLast.length) return 20;
  }
  let score = 50;
  if (idFirst && tokens.some((r) => tokenMatch(idFirst, r))) score += 30;
  else if (idFirst) return 25;
  if (idMiddle.length > 0) {
    const firstInitial = idMiddle[0]?.[0] ?? "";
    const hit = idMiddle.some((t) => tokens.some((r) => tokenMatch(t, r)));
    const initialHit =
      firstInitial && tokens.some((r) => r.startsWith(firstInitial) || (r.length === 1 && idMiddle.some((m) => m.startsWith(r))));
    if (hit || initialHit) score += 15;
  } else {
    score += 5;
  }
  if (identity.suffix && tokens.includes(normToken(identity.suffix))) score += 5;
  return Math.min(100, score);
}

export async function matchLearnerCandidates(
  ctx: { userId: string; role: string },
  identity: LearnerIdentity,
  limit = 3,
): Promise<{ candidates: RosterCandidate[]; rosterOnlyLrn: boolean }> {
  const band = await resolveGradeBand(ctx.role, ctx.userId);
  const where = band.length > 0 ? { gradeLevel: { in: band as never[] } } : {};

  // 1) LRN-exact decides immediately.
  if (identity.lrn) {
    const hit = await prisma.studentProfile.findFirst({
      where: { lrn: identity.lrn, ...(where as object) },
      select: {
        userId: true,
        lrn: true,
        gradeLevel: true,
        user: { select: { fullName: true } },
        section: { select: { name: true } },
      },
    });
    if (hit) {
      return {
        candidates: [
          {
            studentId: hit.userId,
            lrn: hit.lrn,
            fullName: hit.user.fullName,
            gradeLevel: String(hit.gradeLevel),
            section: hit.section?.name ?? "—",
            matchKind: "lrn-exact",
            score: 100,
          },
        ],
        rosterOnlyLrn: false,
      };
    }
  }

  // 2) Name search across band profiles (narrow select, capped).
  const profiles = await prisma.studentProfile.findMany({
    where: where as object,
    orderBy: { lrn: "asc" },
    take: 1000,
    select: {
      userId: true,
      lrn: true,
      gradeLevel: true,
      user: { select: { fullName: true } },
      section: { select: { name: true } },
    },
  });
  const scored = profiles
    .map((p) => ({
      studentId: p.userId,
      lrn: p.lrn,
      fullName: p.user.fullName,
      gradeLevel: String(p.gradeLevel),
      section: p.section?.name ?? "—",
      matchKind: "name",
      score: scoreNameMatch(identity, p.user.fullName),
    }))
    .filter((c) => c.score >= 55)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // 3) Roster-only hint: LRN enrolled but no account yet.
  let rosterOnlyLrn = false;
  if (identity.lrn && scored.length === 0) {
    const roster = await prisma.studentRoster.findFirst({
      where: { lrn: identity.lrn },
      select: { id: true },
    });
    rosterOnlyLrn = !!roster;
  }
  return { candidates: scored, rosterOnlyLrn };
}
