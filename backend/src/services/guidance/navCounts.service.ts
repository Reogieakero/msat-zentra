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
  /**
   * Everything the alerts desk board can render: guidance referrals in *any*
   * status (the board has no status filter), every intervention of the term
   * (the board uses `outcome: "all"`) and every learner the risk engine has
   * detected (the board's live cohort includes learners with no plan row yet).
   */
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
  /** Booked sessions and ADM parent meetings shown on the schedule calendar. */
  schedule: GuidanceNavEntry[];
  /** Referred records the anecdotal desk files (referrals + follow-up cases). */
  anecdotal: GuidanceNavEntry[];
  /** Counseling sessions that already carry filed images — the documents desk. */
  documents: GuidanceNavEntry[];
  /** ADM cases on the referrals report page. */
  report: GuidanceNavEntry[];
}

/**
 * Version map for the given cases. `xmin` (plus the newest session `xmin` and
 * the session attachments) is a single roundtrip per table and tracks every
 * write the desks care about — status moves, intake, follow-up dates, outcomes,
 * session booked/completed/rescheduled/cancelled, and a document filed against
 * a session — rather than a hand-maintained list of columns.
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
             c.xmin::text || ':' || COUNT(DISTINCT s.id)::text || ':' ||
             COALESCE(MAX(s.xmin::text::bigint)::text, '0') || ':' ||
             COUNT(a.id)::text || ':' ||
             COALESCE(MAX(a.xmin::text::bigint)::text, '0') AS v
      FROM ${Prisma.raw(`"${table}"`)} c
      LEFT JOIN "CounselingSession" s ON s.${Prisma.raw(`"${sessionColumn}"`)} = c.id
      LEFT JOIN "ClinicSessionAttachment" a ON a."sessionId" = s.id
      WHERE c.id IN (${Prisma.join(ids)})
      GROUP BY c.id, c.xmin
    `,
  );
  const map: Record<string, string> = {};
  for (const row of rows) map[row.id] = row.v;
  return map;
}

/**
 * Latest risk snapshot per learner for the term. The alerts desk board renders
 * the live cohort, which includes learners the risk engine has detected but
 * that have no `Intervention` row (no plan yet) — a `RiskSnapshot` is written
 * on every flag change, so it is the cheap detection feed for those cards.
 *
 * Only the newest snapshot of a learner counts: an earlier Moderate row must
 * not keep the dot lit after the learner recovered to Low. `xmin` moves only
 * when a new snapshot is written (the sweep does not re-snapshot an unchanged
 * learner), so this cannot churn the badge.
 */
async function latestSnapshotLevels(
  termId: string,
): Promise<Record<string, { level: string; v: string }>> {
  const rows = await prisma.$queryRaw<
    { key: string; level: string; v: string }[]
  >(
    Prisma.sql`
      SELECT key, "riskLevel"::text AS level, v
      FROM (
        SELECT DISTINCT ON (key) key, "riskLevel", v
        FROM (
          SELECT COALESCE("studentId", 'roster:' || "rosterId") AS key,
                 "riskLevel",
                 xmin::text AS v,
                 "snapshotDate"
          FROM "RiskSnapshot"
          WHERE "termId" = ${termId}
        ) s
        ORDER BY key, "snapshotDate" DESC, v::bigint DESC
      ) latest
    `,
  );
  const map: Record<string, { level: string; v: string }> = {};
  for (const row of rows) map[row.key] = { level: row.level, v: row.v };
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
 * One entry per booked schedule item the calendar renders. The version is the
 * fields the calendar actually shows (start / status / kind / venue), so a new
 * booking, a reschedule, a cancellation or an attendance log bumps only the
 * card that changed — a case note or risk move does not light the schedule dot.
 * `AdmParentMeeting` is included here because the calendar renders it too; it
 * is not a published realtime table, so this 5s poll is what keeps the dot
 * honest when the coordinator books a meeting.
 */
async function scheduleEntriesFor(
  referralIds: string[],
  interventionIds: string[],
): Promise<GuidanceNavEntry[]> {
  const sessionOr = [
    ...(referralIds.length ? [{ referralId: { in: referralIds } }] : []),
    ...(interventionIds.length ? [{ interventionId: { in: interventionIds } }] : []),
  ];
  if (sessionOr.length === 0) return [];

  const meetingOr = referralIds.length
    ? [
        { referralId: { in: referralIds } },
        { admLearnerProfile: { referralId: { in: referralIds } } },
      ]
    : [];

  const [sessions, meetings] = await Promise.all([
    prisma.counselingSession.findMany({
      where: { OR: sessionOr },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        venue: true,
        sessionType: true,
      },
    }),
    meetingOr.length
      ? prisma.admParentMeeting.findMany({
          where: { OR: meetingOr },
          select: { id: true, meetingDatetime: true, venue: true, attended: true },
        })
      : Promise.resolve([]),
  ]);

  return [
    ...sessions.map((s) => ({
      id: `session:${s.id}`,
      v: [s.scheduledAt.toISOString(), s.status, s.sessionType, s.venue ?? ""].join("|"),
    })),
    ...meetings.map((m) => ({
      id: `meeting:${m.id}`,
      v: [m.meetingDatetime.toISOString(), m.attended ? "attended" : "scheduled", m.venue].join(
        "|",
      ),
    })),
  ];
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

  const [adm, counseling, interventions, deskReferrals, termInterventions, snapshots] =
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
        select: { id: true, studentId: true, rosterId: true },
      }),
      prisma.intervention.findMany({
        where: { ...termFilter },
        select: { id: true },
      }),
      ctx.termId
        ? latestSnapshotLevels(ctx.termId)
        : Promise.resolve({} as Record<string, { level: string; v: string }>),
    ]);

  const admIds = adm.map((row) => row.id);
  const counselingIds = counseling.map((row) => row.id);
  const interventionIds = interventions.map((row) => row.id);
  const deskReferralIds = deskReferrals.map((row) => row.id);
  const termInterventionIds = termInterventions.map((row) => row.id);
  const learnerKeyOf = (row: {
    studentId: string | null;
    rosterId: string | null;
  }) => row.studentId ?? (row.rosterId ? `roster:${row.rosterId}` : null);

  const [referralVersions, interventionVersions, documentVersionsById, scheduleEntries] =
    await Promise.all([
      versions("Referral", "referralId", [...new Set(deskReferralIds)]),
      versions("Intervention", "interventionId", [
        ...new Set([...interventionIds, ...termInterventionIds]),
      ]),
      documentVersions(deskReferralIds, termInterventionIds),
      // Only needs the ids loaded above, so it runs alongside the version
      // maps instead of after them (each DB roundtrip costs ~0.5s over the
      // pooler; this endpoint must stay cheap because every realtime frame
      // refetches it to move the sidebar dot).
      scheduleEntriesFor(deskReferralIds, termInterventionIds),
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
  const interventionEntries = interventionIds.map(interventionEntry);
  const insightEntries = termInterventionIds.map(interventionEntry);

  // Alerts mirrors what the board renders (see `alertCases.service.ts`): every
  // desk referral regardless of status, every intervention of the term
  // (`outcome: "all"`), and the detected learners that have no plan row yet.
  // Referral cards whose learner has recovered to Low are dropped by the board,
  // so they must not raise the dot either; an unknown level (no snapshot) stays
  // in, exactly like the board's empty risk chip.
  const alertReferralEntries = deskReferrals
    .filter((row) => {
      const key = learnerKeyOf(row);
      return !key || snapshots[key]?.level !== "Low";
    })
    .map((row) => referralEntry(row.id));
  const detectionEntries: GuidanceNavEntry[] = Object.entries(snapshots)
    .filter(([, snapshot]) => snapshot.level !== "Low")
    .map(([key, snapshot]) => ({ id: `student:${key}`, v: snapshot.v }));
  const alertEntries = mergeEntries(
    alertReferralEntries,
    termInterventionIds.map(interventionEntry),
    detectionEntries,
  );

  return {
    alerts: alertEntries,
    // The board renders detected learners that have no plan row yet, so the
    // Interventions dot must move for them too — otherwise a detection whose
    // adviser has not connected student data lands on the page without a dot.
    interventions: mergeEntries(interventionEntries, detectionEntries),
    adm: admEntries,
    counseling: counselingEntries,
    overview: mergeEntries(alertEntries, interventionEntries),
    insights: insightEntries,
    schedule: scheduleEntries,
    anecdotal: mergeEntries(
      deskReferralIds.map(referralEntry),
      termInterventionIds.map(interventionEntry),
    ),
    documents: Object.keys(documentVersionsById).map(documentEntry),
    report: admEntries,
  };
}
