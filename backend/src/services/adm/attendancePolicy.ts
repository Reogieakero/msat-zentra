import { prisma } from "../../lib/prisma.js";

/**
 * ADM attendance exemption policy.
 *
 * An ADM learner stops being counted against seat-time attendance only once
 * the Principal has APPROVED AND SIGNED the case — `principalApprove` sets
 * `approvedBy`/`approvedAt` and moves the case to `enrollment_monitoring`
 * (services/adm/profiles.progression.service.ts). Cases still being assessed
 * (anecdotal → certification) and certified-but-unsigned cases keep normal
 * attendance; `principalReturn` clears `approvedBy`, which revokes the
 * exemption automatically.
 *
 * Module submissions are deliberately NOT attendance evidence (owner decision
 * 2026-11-04) — AdmModule progress stays an oversight signal only.
 */
const EXEMPT_STAGES = new Set<string>(["enrollment_monitoring", "completion"]);

export interface AdmCaseSnapshot {
  approvedBy: string | null;
  returnedAt: Date | null;
  stage: string;
}

/** Pure predicate — the single source of truth for "is this case signed off". */
export function isExemptCase(profile: AdmCaseSnapshot): boolean {
  return (
    !!profile.approvedBy &&
    !profile.returnedAt &&
    EXEMPT_STAGES.has(profile.stage)
  );
}

type LatestCase = AdmCaseSnapshot & {
  studentId: string;
  term: { schoolYearId: string; startDate: Date | null } | null;
};

/**
 * Most recent ADM case per learner, plus whether it carries the exemption
 * forward. The case is term-scoped, so a learner approved in term 1 with no
 * new case in term 2 keeps the exemption — but only inside the same school
 * year (a new school year re-assesses the learner).
 */
async function latestCasesByStudent(
  termId: string,
  studentIds?: string[],
): Promise<Map<string, { exempt: boolean; stage: string }>> {
  const term = await prisma.term.findUnique({
    where: { id: termId },
    select: { schoolYearId: true, startDate: true },
  });
  if (!term) return new Map();

  const rows = (await prisma.admLearnerProfile.findMany({
    where: studentIds && studentIds.length > 0 ? { studentId: { in: studentIds } } : {},
    select: {
      studentId: true,
      approvedBy: true,
      returnedAt: true,
      stage: true,
      createdAt: true,
      term: { select: { schoolYearId: true, startDate: true } },
    },
    orderBy: { createdAt: "desc" },
  })) as LatestCase[];

  const out = new Map<string, { exempt: boolean; stage: string }>();
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.studentId)) continue;
    seen.add(row.studentId);

    let exempt = isExemptCase(row);
    if (exempt) {
      const sameYear = row.term?.schoolYearId === term.schoolYearId;
      const notFuture =
        !row.term?.startDate ||
        !term.startDate ||
        row.term.startDate.getTime() <= term.startDate.getTime();
      exempt = sameYear && notFuture;
    }
    out.set(row.studentId, { exempt, stage: row.stage });
  }
  return out;
}

/** Signed-and-active ADM learners for a term (carry-forward included). */
export async function admExemptStudentIds(termId: string): Promise<Set<string>> {
  const cases = await latestCasesByStudent(termId);
  const out = new Set<string>();
  for (const [studentId, info] of cases) {
    if (info.exempt) out.add(studentId);
  }
  return out;
}

/** Same map, for desks that also want to badge the case stage. */
export async function admCaseSnapshot(
  termId: string,
  studentIds: string[],
): Promise<Map<string, { exempt: boolean; stage: string }>> {
  return latestCasesByStudent(termId, studentIds);
}

export async function isAdmExempt(studentId: string, termId: string): Promise<boolean> {
  const cases = await latestCasesByStudent(termId, [studentId]);
  return cases.get(studentId)?.exempt ?? false;
}
