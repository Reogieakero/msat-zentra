import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import type { GuidanceContext } from "./guidance.types.js";

/** One queue row: the case id plus a version that changes on every update. */
export interface GuidanceNavEntry {
  id: string;
  /**
   * Postgres tuple version (`xmin`) — bumps on every UPDATE of the case row and
   * of any of its counseling sessions, so the sidebar badge can tell "this case
   * changed" from "nothing happened" without a schema column, and without
   * depending on a notification being fanned out.
   */
  v: string;
}

export interface GuidanceNavQueues {
  /** Pending guidance referrals (ADM + counseling) — the alerts desk's inbox. */
  alerts: GuidanceNavEntry[];
  /** Ongoing interventions the guidance desk can action. */
  interventions: GuidanceNavEntry[];
  /** Pending ADM referrals addressed to guidance. */
  adm: GuidanceNavEntry[];
  /** Pending counseling referrals addressed to guidance. */
  counseling: GuidanceNavEntry[];
  /** Everything the overview dashboard aggregates. */
  overview: GuidanceNavEntry[];
  /** Every intervention in the term — the insights page aggregates all of them. */
  insights: GuidanceNavEntry[];
  /** Referred records the anecdotal desk files (referrals + follow-up cases). */
  anecdotal: GuidanceNavEntry[];
  /** Counseling sessions that already carry filed images — the documents desk. */
  documents: GuidanceNavEntry[];
  /** ADM cases on the referrals report page. */
  report: GuidanceNavEntry[];
}

/**
 * Version map for the given cases. `xmin` (plus the newest session `xmin`) is a
 * single roundtrip per table and tracks every write the desks care about —
 * status moves, intake, follow-up dates, outcomes, session booked/completed/
 * rescheduled/cancelled — rather than a hand-maintained list of columns.
 */
async function versions(
  table: "Referral" | "Intervention",
  sessionColumn: "referralId" | "interventionId",
  ids: string[],
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const rows = await prisma.$queryRaw<{ id: string; v: string }[]>(
    Prisma.sql`
      SELECT c.id,
             c.xmin::text || ':' || COUNT(s.id)::text || ':' ||
             COALESCE(MAX(s.xmin::text::bigint)::text, '0') AS v
      FROM ${Prisma.raw(`"${table}"`)} c
      LEFT JOIN "CounselingSession" s ON s.${Prisma.raw(`"${sessionColumn}"`)} = c.id
      WHERE c.id IN (${Prisma.join(ids)})
      GROUP BY c.id, c.xmin
    `,
  );
  const map: Record<string, string> = {};
  for (const row of rows) map[row.id] = row.v;
  return map;
}

/**
 * Version map for counseling sessions that carry at least one image attachment
 * (exactly what the session-documents desk renders). A new upload, a replaced
 * image, or a deleted attachment changes the version; a session with no images
 * is not part of that desk and never badges it.
 */
async function documentVersions(
  referralIds: string[],
  interventionIds: string[],
): Promise<Record<string, string>> {
  const clauses: Prisma.Sql[] = [];
  if (referralIds.length > 0) {
    clauses.push(Prisma.sql`s."referralId" IN (${Prisma.join(referralIds)})`);
  }
  if (interventionIds.length > 0) {
    clauses.push(
      Prisma.sql`s."interventionId" IN (${Prisma.join(interventionIds)})`,
    );
  }
  if (clauses.length === 0) return {};
  const rows = await prisma.$queryRaw<{ id: string; v: string }[]>(
    Prisma.sql`
      SELECT s.id,
             s.xmin::text || ':' || COUNT(a.id)::text || ':' ||
             COALESCE(MAX(a.xmin::text::bigint)::text, '0') AS v
      FROM "CounselingSession" s
      LEFT JOIN "ClinicSessionAttachment" a
        ON a."sessionId" = s.id AND a."mimeType" ILIKE 'image/%'
      WHERE ${Prisma.join(clauses, " OR ")}
      GROUP BY s.id, s.xmin
      HAVING COUNT(a.id) > 0
    `,
  );
  const map: Record<string, string> = {};
  for (const row of rows) map[row.id] = row.v;
  return map;
}

/** Same id set, one entry per id (id collisions across tables are impossible). */
function mergeEntries(...groups: GuidanceNavEntry[][]): GuidanceNavEntry[] {
  const seen = new Set<string>();
  const merged: GuidanceNavEntry[] = [];
  for (const group of groups) {
    for (const entry of group) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      merged.push(entry);
    }
  }
  return merged;
}

/**
 * Compact queue entries for the guidance sidebar badges. The badge is "new or
 * updated since you last opened this page", so the client needs each case's id
 * *and* version to diff against what it has already seen — a case that changes
 * while the counselor is elsewhere must move the badge even though no new
 * notification necessarily exists for it.
 *
 * Kept separate from `/overview` so every guidance page can poll a tiny
 * payload instead of the full dashboard.
 */
export async function getNavQueues(ctx: GuidanceContext): Promise<GuidanceNavQueues> {
  const termFilter = ctx.termId ? { termId: ctx.termId } : {};
  const deskScope = {
    OR: [
      { referredToRole: "guidance_counselor" as const },
      {
        referredToRole: "adm_coordinator" as const,
        OR: [{ consultReviewer: null }, { consultReviewer: "guidance_counselor" }],
      },
    ],
  };

  const [adm, counseling, interventions, deskReferrals, termInterventions] =
    await Promise.all([
      prisma.referral.findMany({
        where: {
          status: "pending",
          ...termFilter,
          OR: [
            { referredToRole: "guidance_counselor", escalatedTo: "adm_coordinator" },
            {
              referredToRole: "adm_coordinator",
              OR: [{ consultReviewer: null }, { consultReviewer: "guidance_counselor" }],
            },
          ],
        },
        select: { id: true },
      }),
      prisma.referral.findMany({
        where: {
          status: "pending",
          referredToRole: "guidance_counselor",
          ...termFilter,
          OR: [{ escalatedTo: null }, { NOT: { escalatedTo: "adm_coordinator" } }],
        },
        select: { id: true },
      }),
      prisma.intervention.findMany({
        where: {
          outcomeStatus: "ongoing",
          ...termFilter,
        },
        select: { id: true },
      }),
      prisma.referral.findMany({
        where: { ...deskScope, ...termFilter },
        select: { id: true },
      }),
      prisma.intervention.findMany({
        where: { ...termFilter },
        select: { id: true },
      }),
    ]);

  const admIds = adm.map((row) => row.id);
  const counselingIds = counseling.map((row) => row.id);
  const alertIds = [...new Set([...admIds, ...counselingIds])];
  const interventionIds = interventions.map((row) => row.id);
  const deskReferralIds = deskReferrals.map((row) => row.id);
  const termInterventionIds = termInterventions.map((row) => row.id);

  const [referralVersions, interventionVersions, documentVersionsById] =
    await Promise.all([
      versions("Referral", "referralId", [
        ...new Set([...alertIds, ...counselingIds, ...deskReferralIds]),
      ]),
      versions("Intervention", "interventionId", [
        ...new Set([...interventionIds, ...termInterventionIds]),
      ]),
      documentVersions(deskReferralIds, termInterventionIds),
    ]);

  const referralEntry = (id: string): GuidanceNavEntry => ({
    id,
    v: referralVersions[id] ?? "",
  });
  const interventionEntry = (id: string): GuidanceNavEntry => ({
    id,
    v: interventionVersions[id] ?? "",
  });
  const documentEntry = (id: string): GuidanceNavEntry => ({
    id,
    v: documentVersionsById[id] ?? "",
  });

  const admEntries = admIds.map(referralEntry);
  const counselingEntries = counselingIds.map(referralEntry);
  const alertEntries = alertIds.map(referralEntry);
  const interventionEntries = interventionIds.map(interventionEntry);
  const insightEntries = termInterventionIds.map(interventionEntry);

  return {
    alerts: alertEntries,
    interventions: interventionEntries,
    adm: admEntries,
    counseling: counselingEntries,
    overview: mergeEntries(alertEntries, interventionEntries),
    insights: insightEntries,
    anecdotal: mergeEntries(
      deskReferralIds.map(referralEntry),
      termInterventionIds.map(interventionEntry),
    ),
    documents: Object.keys(documentVersionsById).map(documentEntry),
    report: admEntries,
  };
}
