import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";

/** One queue row: the case id plus a version that changes on update. */
export interface NurseNavEntry {
  id: string;
  /**
   * Postgres tuple version (`xmin`) of the row(s) behind the entry — it bumps on
   * every UPDATE without a schema column, so the sidebar dot can tell "this
   * changed" from "nothing happened" and never depends on a notification being
   * fanned out.
   */
  v: string;
}

/**
 * One list per nurse sidebar page. Kept in sync with `ROUTE_KEYS` in
 * `frontend/src/services/nurse/navCounts.service.ts`.
 */
export interface NurseNavQueues {
  /** Overview: the desk queue plus the nurse's unread notifications. */
  overview: NurseNavEntry[];
  /** Alerts board: the desk queue plus unread notifications. */
  alerts: NurseNavEntry[];
  /** ADM cases referred to (or reviewed by) the nurse. */
  adm: NurseNavEntry[];
  /** Clinic matters (every non-ADM referral on the nurse desk). */
  clinic: NurseNavEntry[];
  /** Finished clinic records: referrals with at least one completed session. */
  records: NurseNavEntry[];
  /** Referrals report: ADM cases plus the risk snapshots behind them. */
  report: NurseNavEntry[];
}

export interface NurseNavContext {
  userId: string;
  termId: string | null;
}

function mergeEntries(...groups: NurseNavEntry[][]): NurseNavEntry[] {
  const seen = new Set<string>();
  const merged: NurseNavEntry[] = [];
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
 * Compact queue entries for the nurse sidebar badges. One roundtrip on purpose:
 * the rail polls this on a short interval, and every extra query costs a full
 * pooler roundtrip. The desk scope mirrors `listQueue` in
 * `services/referrals/queues.desk.service.ts` (referred to the nurse, escalated
 * to the nurse, or an ADM consultation the nurse reviews), so a dot only lights
 * for a case the nurse can actually open.
 */
export async function getNurseNavQueues(
  ctx: NurseNavContext,
): Promise<NurseNavQueues> {
  const termFilter = ctx.termId
    ? Prisma.sql`AND c."termId" = ${ctx.termId}`
    : Prisma.sql`AND FALSE`;
  const riskTermFilter = ctx.termId
    ? Prisma.sql`AND r."termId" = ${ctx.termId}`
    : Prisma.sql`AND FALSE`;

  const rows = await prisma.$queryRaw<{ q: string; id: string; v: string }[]>(
    Prisma.sql`
      WITH desk AS (
        SELECT c.id, c."referredToRole"
        FROM "Referral" c
        WHERE (
            c."referredToRole" = 'nurse'
            OR (c."status" = 'escalated' AND c."escalatedTo" = 'nurse')
            OR (c."referredToRole" = 'adm_coordinator' AND c."consultReviewer" = 'nurse')
          )
          ${termFilter}
      ),
      versions AS (
        SELECT c.id,
               c.xmin::text || ':' || COUNT(DISTINCT s.id)::text || ':' ||
               COALESCE(MAX(s.xmin::text::bigint)::text, '0') || ':' ||
               COUNT(a.id)::text || ':' ||
               COALESCE(MAX(a.xmin::text::bigint)::text, '0') AS v
        FROM "Referral" c
        LEFT JOIN "CounselingSession" s ON s."referralId" = c.id
        LEFT JOIN "ClinicSessionAttachment" a ON a."sessionId" = s.id
        WHERE c.id IN (SELECT id FROM desk)
        GROUP BY c.id, c.xmin
      ),
      desk_rows AS (
        SELECT d.id, d."referredToRole", versions.v
        FROM desk d
        JOIN versions ON versions.id = d.id
      ),
      records AS (
        SELECT c.id,
               c.xmin::text || ':' || COUNT(DISTINCT s.id)::text || ':' ||
               COALESCE(MAX(s.xmin::text::bigint)::text, '0') || ':' ||
               COUNT(a.id)::text || ':' ||
               COALESCE(MAX(a.xmin::text::bigint)::text, '0') AS v
        FROM "Referral" c
        JOIN "CounselingSession" s
          ON s."referralId" = c.id AND s.status = 'completed'
        LEFT JOIN "ClinicSessionAttachment" a ON a."sessionId" = s.id
        WHERE c.id IN (SELECT id FROM desk)
        GROUP BY c.id, c.xmin
      ),
      notifications AS (
        SELECT id, xmin::text AS v
        FROM "Notification"
        WHERE "userId" = ${ctx.userId} AND "isRead" = false
      ),
      risk AS (
        SELECT DISTINCT ON (key) 'student:' || key AS id, v
        FROM (
          SELECT COALESCE(r."studentId", 'roster:' || r."rosterId") AS key,
                 xmin::text AS v,
                 "snapshotDate"
          FROM "RiskSnapshot" r
          WHERE (
              r."studentId" IN (
                SELECT d."studentId" FROM "Referral" d
                WHERE d.id IN (SELECT id FROM desk) AND d."studentId" IS NOT NULL
              )
              OR r."rosterId" IN (
                SELECT d."rosterId" FROM "Referral" d
                WHERE d.id IN (SELECT id FROM desk) AND d."rosterId" IS NOT NULL
              )
            )
            ${riskTermFilter}
        ) s
        ORDER BY key, "snapshotDate" DESC, v::bigint DESC
      )
      SELECT 'overview'::text AS q, id, v FROM desk_rows
      UNION ALL SELECT 'overview', id, v FROM notifications
      UNION ALL SELECT 'alerts', id, v FROM desk_rows
      UNION ALL SELECT 'alerts', id, v FROM notifications
      UNION ALL SELECT 'adm', id, v FROM desk_rows WHERE "referredToRole" = 'adm_coordinator'
      UNION ALL SELECT 'clinic', id, v FROM desk_rows WHERE "referredToRole" <> 'adm_coordinator'
      UNION ALL SELECT 'records', id, v FROM records
      UNION ALL SELECT 'report', id, v FROM desk_rows WHERE "referredToRole" = 'adm_coordinator'
      UNION ALL SELECT 'report', id, v FROM risk
    `,
  );

  const queues: NurseNavQueues = {
    overview: [],
    alerts: [],
    adm: [],
    clinic: [],
    records: [],
    report: [],
  };
  for (const row of rows) {
    const key = row.q as keyof NurseNavQueues;
    if (!(key in queues)) continue;
    queues[key].push({ id: row.id, v: row.v });
  }

  return {
    ...queues,
    overview: mergeEntries(queues.overview),
    alerts: mergeEntries(queues.alerts),
    adm: mergeEntries(queues.adm),
    clinic: mergeEntries(queues.clinic),
    records: mergeEntries(queues.records),
    report: mergeEntries(queues.report),
  };
}
