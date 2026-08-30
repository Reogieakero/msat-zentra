import { prisma } from "./prisma.js";

export type LrnVerdict = "match" | "mismatch" | "not_found";

export type LrnMatchResult = {
  claimedLrn: string;
  found: boolean;
  roster?: {
    lrn: string;
    fullName: string;
    gradeLevel: string;
    section: string | null;
  };
  lrnMatch: boolean;
  nameSimilarity: number; // 0..1
  nameMatch: boolean;
  verdict: LrnVerdict;
};

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function similarity(a: string, b: string): number {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return 0;
  const dist = levenshtein(x, y);
  const maxLen = Math.max(x.length, y.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

// Compares a sign-up applicant's claimed LRN + name against the official
// StudentRoster so the registrar can verify identity before approving.
export async function matchLrn(claimedLrn: string, claimedName: string): Promise<LrnMatchResult> {
  const lrn = claimedLrn.trim();
  const roster = await prisma.studentRoster.findFirst({
    where: { lrn },
    include: { section: { select: { name: true } } },
    orderBy: { schoolYearId: "desc" },
  });

  if (!roster) {
    return {
      claimedLrn: lrn,
      found: false,
      lrnMatch: false,
      nameSimilarity: 0,
      nameMatch: false,
      verdict: "not_found",
    };
  }

  const nameSimilarity = similarity(claimedName, roster.fullName);
  const lrnMatch = true;
  const nameMatch = nameSimilarity >= 0.85;
  const verdict: LrnVerdict = lrnMatch && nameMatch ? "match" : "mismatch";

  return {
    claimedLrn: lrn,
    found: true,
    roster: {
      lrn: roster.lrn,
      fullName: roster.fullName,
      gradeLevel: roster.gradeLevel,
      section: roster.section?.name ?? null,
    },
    lrnMatch,
    nameSimilarity: Number(nameSimilarity.toFixed(3)),
    nameMatch,
    verdict,
  };
}
