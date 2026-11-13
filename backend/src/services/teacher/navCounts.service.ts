import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";

/** One queue row: the case/learner id plus a version that changes on update. */
export interface TeacherNavEntry {
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
 * One list per adviser sidebar page. Kept in sync with `ROUTE_KEYS` in
 * `frontend/src/services/teacher/navCounts.service.ts`.
 */
export interface TeacherNavQueues {
  /** Dashboard: everything the adviser desk aggregates. */
  overview: TeacherNavEntry[];
  /** Advisory list: learners enlisted / moved / removed. */
  advisoryList: TeacherNavEntry[];
  /** Advisory attendance sheet: marks taken for the advisees. */
  adviseeAttendance: TeacherNavEntry[];
  /** Advisory academics: finals written or moved for the advisees. */
  adviseeAcademic: TeacherNavEntry[];
  /** Anecdotal records filed about the advisees (by any observer). */
  anecdotal: TeacherNavEntry[];
  /** Referrals the teacher filed — status moves by the receiving desks. */
  referrals: TeacherNavEntry[];
  /** Interventions guidance opened / moved for the advisees, plus detections. */
  interventions: TeacherNavEntry[];
  /** ADM cases tracked for the adviser's learners. */
  adm: TeacherNavEntry[];
  /** Advisory modules and their learner submissions. */
  modules: TeacherNavEntry[];
  /** Section timetable the advisory schedule page renders. */
  schedule: TeacherNavEntry[];
  /** The adviser's SF10 access requests (registry decisions). */
  sf10: TeacherNavEntry[];
}

export interface TeacherNavContext {
  userId: string;
  role: string;
  termId: string | null;
  schoolYearId: string | null;
}

const EMPTY_QUEUES: TeacherNavQueues = {
  overview: [],
  advisoryList: [],
  adviseeAttendance: [],
  adviseeAcademic: [],
  anecdotal: [],
  referrals: [],
  interventions: [],
  adm: [],
  modules: [],
  schedule: [],
  sf10: [],
};

/** Same id set, one entry per id. */
function mergeEntries(...groups: TeacherNavEntry[][]): TeacherNavEntry[] {
  const seen = new Set<string>();
  const merged: TeacherNavEntry[] = [];
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
 * Compact queue entries for the adviser sidebar badges. The badge means "new or
 * updated since you last opened that page", so the client needs each case's id
 * *and* version to diff against what it has already seen — a case that changes
 * while the teacher is elsewhere must move the dot even though no notification
 * necessarily exists for it.
 *
 * One roundtrip on purpose: every teacher desk polls this on a short interval,
 * and each extra query costs a full pooler roundtrip (~0.4s here). All the
 * section/learner scoping is expressed as CTEs, so the payload is still bounded
 * to the adviser's own learners.
 */
export async function getTeacherNavQueues(
  ctx: TeacherNavContext,
): Promise<TeacherNavQueues> {
  // Section scope: the adviser's own sections for the selected school year. A
  // subject teacher without an advisory section still files referrals, so this
  // stays a filter (empty → only the referral/SF10 branches can return rows)
  // instead of a 404 like the advisory pages.
  const sections = ctx.schoolYearId
    ? Prisma.sql`SELECT id FROM "Section" WHERE "adviserId" = ${ctx.userId} AND "schoolYearId" = ${ctx.schoolYearId}`
    : Prisma.sql`SELECT id FROM "Section" WHERE "adviserId" = ${ctx.userId}`;
  const termFilter = (column: string) =>
    ctx.termId
      ? Prisma.sql`${Prisma.raw(column)} = ${ctx.termId}`
      : Prisma.sql`FALSE`;
  const yearFilter = ctx.schoolYearId
    ? Prisma.sql`AND t."schoolYearId" = ${ctx.schoolYearId}`
    : Prisma.empty;
  const adviseeRef = Prisma.sql`(
    "studentId" IN (SELECT "userId" FROM "StudentProfile" WHERE "sectionId" IN (${sections}))
    OR "rosterId" IN (SELECT id FROM "StudentRoster" WHERE "sectionId" IN (${sections}))
  )`;

  const rows = await prisma.$queryRaw<{ q: string; id: string; v: string }[]>(
    Prisma.sql`
      WITH sec AS (${sections}),
      referrals AS (
        SELECT c.id,
               c.xmin::text || ':' || COUNT(DISTINCT s.id)::text || ':' ||
               COALESCE(MAX(s.xmin::text::bigint)::text, '0') || ':' ||
               COUNT(a.id)::text || ':' ||
               COALESCE(MAX(a.xmin::text::bigint)::text, '0') AS v
        FROM "Referral" c
        LEFT JOIN "CounselingSession" s ON s."referralId" = c.id
        LEFT JOIN "ClinicSessionAttachment" a ON a."sessionId" = s.id
        WHERE c."referredBy" = ${ctx.userId} AND ${termFilter('c."termId"')}
        GROUP BY c.id, c.xmin
      ),
      interventions AS (
        SELECT c.id,
               c.xmin::text || ':' || COUNT(DISTINCT s.id)::text || ':' ||
               COALESCE(MAX(s.xmin::text::bigint)::text, '0') || ':' ||
               COUNT(a.id)::text || ':' ||
               COALESCE(MAX(a.xmin::text::bigint)::text, '0') AS v
        FROM "Intervention" c
        LEFT JOIN "CounselingSession" s ON s."interventionId" = c.id
        LEFT JOIN "ClinicSessionAttachment" a ON a."sessionId" = s.id
        WHERE ${termFilter('c."termId"')}
          AND (c."studentId" IN (
                 SELECT "userId" FROM "StudentProfile" WHERE "sectionId" IN (SELECT id FROM sec)
               )
               OR c."rosterId" IN (
                 SELECT id FROM "StudentRoster" WHERE "sectionId" IN (SELECT id FROM sec)
               ))
        GROUP BY c.id, c.xmin
      ),
      detections AS (
        SELECT 'student:' || key AS id, v
        FROM (
          SELECT DISTINCT ON (key) key, "riskLevel"::text AS level, v
          FROM (
            SELECT COALESCE("studentId", 'roster:' || "rosterId") AS key,
                   "riskLevel",
                   xmin::text AS v,
                   "snapshotDate"
            FROM "RiskSnapshot"
            WHERE ${termFilter('"termId"')}
              AND (${adviseeRef})
          ) s
          ORDER BY key, "snapshotDate" DESC, v::bigint DESC
        ) latest
        WHERE level <> 'Low'
      ),
      grades AS (
        SELECT 'learner:' || COALESCE("studentId", 'roster:' || "rosterId") AS id,
               COUNT(*)::text || ':' ||
               COALESCE(MAX(xmin::text::bigint)::text, '0') AS v
        FROM "FinalGrade"
        WHERE ${termFilter('"termId"')} AND (${adviseeRef})
        GROUP BY COALESCE("studentId", 'roster:' || "rosterId")
      ),
      attendance AS (
        SELECT 'learner:' || COALESCE("studentId", 'roster:' || "rosterId") AS id,
               COUNT(*)::text || ':' ||
               COALESCE(MAX(xmin::text::bigint)::text, '0') AS v
        FROM "AttendanceRecord"
        WHERE ${termFilter('"termId"')} AND (${adviseeRef})
        GROUP BY COALESCE("studentId", 'roster:' || "rosterId")
      ),
      anecdotal AS (
        SELECT id, xmin::text AS v
        FROM "AnecdotalRecord"
        WHERE ${termFilter('"termId"')}
          AND "deletedAt" IS NULL
          AND "sectionId" IN (SELECT id FROM sec)
      ),
      advisory_list AS (
        SELECT 'profile:' || "userId" AS id, xmin::text AS v
        FROM "StudentProfile"
        WHERE "sectionId" IN (SELECT id FROM sec)
        UNION ALL
        SELECT 'roster:' || id AS id, xmin::text AS v
        FROM "StudentRoster"
        WHERE "sectionId" IN (SELECT id FROM sec)
      ),
      adm AS (
        SELECT p.id,
               p.xmin::text || ':' || r.xmin::text || ':' ||
               (SELECT COUNT(*)::text || ':' ||
                       COALESCE(MAX(x.xmin::text::bigint)::text, '0')
                FROM "AdmParentMeeting" x WHERE x."admLearnerProfileId" = p.id) || ':' ||
               (SELECT COUNT(*)::text || ':' ||
                       COALESCE(MAX(x.xmin::text::bigint)::text, '0')
                FROM "AdmModule" x WHERE x."admLearnerProfileId" = p.id) || ':' ||
               (SELECT COUNT(*)::text || ':' ||
                       COALESCE(MAX(x.xmin::text::bigint)::text, '0')
                FROM "AdmDevice" x WHERE x."admLearnerProfileId" = p.id) || ':' ||
               (SELECT COUNT(*)::text || ':' ||
                       COALESCE(MAX(x.xmin::text::bigint)::text, '0')
                FROM "AdmForm" x WHERE x."admLearnerProfileId" = p.id) AS v
        FROM "AdmLearnerProfile" p
        JOIN "Referral" r ON r.id = p."referralId"
        JOIN "StudentProfile" sp ON sp."userId" = p."studentId"
        JOIN "Term" t ON t.id = p."termId"
        WHERE sp."sectionId" IN (SELECT id FROM sec)
          AND r.status <> 'dismissed'
          ${yearFilter}
      ),
      modules AS (
        SELECT m.id,
               m.xmin::text || ':' || COUNT(s.id)::text || ':' ||
               COALESCE(MAX(s.xmin::text::bigint)::text, '0') AS v
        FROM "AdvisoryModule" m
        LEFT JOIN "AdvisoryModuleSubmission" s ON s."moduleId" = m.id
        WHERE m."sectionId" IN (SELECT id FROM sec) AND ${termFilter('m."termId"')}
        GROUP BY m.id, m.xmin
      ),
      schedule AS (
        SELECT id, xmin::text AS v
        FROM "SectionTimetableEntry"
        WHERE "sectionId" IN (SELECT id FROM sec) AND ${termFilter('"termId"')}
      ),
      sf10 AS (
        SELECT id, xmin::text AS v
        FROM "AdviserSf10AccessRequest"
        WHERE "adviserId" = ${ctx.userId}
      )
      SELECT 'referrals'::text AS q, id, v FROM referrals
      UNION ALL SELECT 'interventions', id, v FROM interventions
      UNION ALL SELECT 'interventions', id, v FROM detections
      UNION ALL SELECT 'adviseeAcademic', id, v FROM grades
      UNION ALL SELECT 'adviseeAttendance', id, v FROM attendance
      UNION ALL SELECT 'anecdotal', id, v FROM anecdotal
      UNION ALL SELECT 'advisoryList', id, v FROM advisory_list
      UNION ALL SELECT 'adm', id, v FROM adm
      UNION ALL SELECT 'modules', id, v FROM modules
      UNION ALL SELECT 'schedule', id, v FROM schedule
      UNION ALL SELECT 'sf10', id, v FROM sf10
    `,
  );

  if (rows.length === 0) return EMPTY_QUEUES;

  const queues: TeacherNavQueues = {
    overview: [],
    advisoryList: [],
    adviseeAttendance: [],
    adviseeAcademic: [],
    anecdotal: [],
    referrals: [],
    interventions: [],
    adm: [],
    modules: [],
    schedule: [],
    sf10: [],
  };
  for (const row of rows) {
    const key = row.q as keyof TeacherNavQueues;
    if (!(key in queues)) continue;
    queues[key].push({ id: row.id, v: row.v });
  }

  const referralEntries = mergeEntries(queues.referrals);
  const interventionEntries = mergeEntries(queues.interventions);
  const academicEntries = mergeEntries(queues.adviseeAcademic);
  const attendanceEntries = mergeEntries(queues.adviseeAttendance);
  const admEntries = mergeEntries(queues.adm);
  const moduleEntries = mergeEntries(queues.modules);

  return {
    ...queues,
    referrals: referralEntries,
    interventions: interventionEntries,
    adviseeAcademic: academicEntries,
    adviseeAttendance: attendanceEntries,
    adm: admEntries,
    modules: moduleEntries,
    // Dashboard renders the same cards the desk pages do.
    overview: mergeEntries(
      referralEntries,
      interventionEntries,
      academicEntries,
      attendanceEntries,
      admEntries,
      moduleEntries,
    ),
  };
}
