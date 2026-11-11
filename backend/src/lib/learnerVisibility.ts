import { prisma } from "./prisma.js";
import { Prisma } from "../generated/prisma/client.js";

export interface ArchivedLearnerIds {
  /** `StudentProfile.userId` values (learners with an account). */
  studentIds: string[];
  /** `StudentRoster.id` values (roster-only learners). */
  rosterIds: string[];
}

const EMPTY: ArchivedLearnerIds = { studentIds: [], rosterIds: [] };
const TTL_MS = 10_000;

let cache: { at: number; ids: ArchivedLearnerIds } | null = null;

/**
 * Learners their section adviser removed from the advisory list.
 *
 * `AdviserArchivedStudent` is per adviser, so a row only applies while that
 * teacher is still the adviser of the learner's current section. A section
 * hand-over or a new school year therefore restores visibility everywhere
 * without deleting the archive row (the adviser desk lists rows per year).
 *
 * Cached for a few seconds because every desk board asks for it per request.
 */
export async function archivedAdvisoryLearnerIds(): Promise<ArchivedLearnerIds> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.ids;

  const rows = await prisma.adviserArchivedStudent.findMany({
    select: { teacherId: true, studentId: true, rosterId: true },
  });
  if (rows.length === 0) {
    cache = { at: Date.now(), ids: EMPTY };
    return EMPTY;
  }

  const studentIds = rows.map((r) => r.studentId).filter((id): id is string => !!id);
  const rosterIds = rows.map((r) => r.rosterId).filter((id): id is string => !!id);

  const [profiles, rosters] = await Promise.all([
    studentIds.length > 0
      ? prisma.studentProfile.findMany({
          where: { userId: { in: studentIds } },
          select: { userId: true, section: { select: { adviserId: true } } },
        })
      : Promise.resolve([]),
    rosterIds.length > 0
      ? prisma.studentRoster.findMany({
          where: { id: { in: rosterIds } },
          select: { id: true, section: { select: { adviserId: true } } },
        })
      : Promise.resolve([]),
  ]);

  const adviserByStudent = new Map(
    profiles
      .filter((p) => p.section?.adviserId)
      .map((p) => [p.userId, p.section!.adviserId as string]),
  );
  const adviserByRoster = new Map(
    rosters
      .filter((r) => r.section?.adviserId)
      .map((r) => [r.id, r.section!.adviserId as string]),
  );

  const ids: ArchivedLearnerIds = {
    studentIds: [
      ...new Set(
        rows
          .filter(
            (r) => r.studentId && adviserByStudent.get(r.studentId) === r.teacherId,
          )
          .map((r) => r.studentId as string),
      ),
    ],
    rosterIds: [
      ...new Set(
        rows
          .filter((r) => r.rosterId && adviserByRoster.get(r.rosterId) === r.teacherId)
          .map((r) => r.rosterId as string),
      ),
    ],
  };

  cache = { at: Date.now(), ids };
  return ids;
}

/** Drop the memo so an archive/restore shows up on the next read. */
export function clearArchivedLearnerCache(): void {
  cache = null;
}

/** Prisma fragment for `StudentProfile` queries. */
export function excludeArchivedProfiles(
  ids: ArchivedLearnerIds,
): { userId?: { notIn: string[] } } {
  return ids.studentIds.length > 0 ? { userId: { notIn: ids.studentIds } } : {};
}

/** Prisma fragment for `StudentRoster` queries. */
export function excludeArchivedRosters(
  ids: ArchivedLearnerIds,
): { id?: { notIn: string[] } } {
  return ids.rosterIds.length > 0 ? { id: { notIn: ids.rosterIds } } : {};
}

/**
 * Raw-SQL fragment for hand-written queries (raw SQL cannot take a Prisma
 * `where` object). `alias` is the roster table alias used in the query.
 */
export function excludeArchivedRostersSql(
  ids: ArchivedLearnerIds,
  alias = "r",
): Prisma.Sql {
  return ids.rosterIds.length > 0
    ? Prisma.sql`AND ${Prisma.raw(`${alias}."id"`)} NOT IN (${Prisma.join(ids.rosterIds)})`
    : Prisma.empty;
}

/** Prisma fragment matching grade/attendance rows (dual identity). */
export function excludeArchivedLearnerRows(
  ids: ArchivedLearnerIds,
): { NOT?: { OR: ({ studentId: { in: string[] } } | { rosterId: { in: string[] } })[] } } {
  const branches: ({ studentId: { in: string[] } } | { rosterId: { in: string[] } })[] = [];
  if (ids.studentIds.length > 0) branches.push({ studentId: { in: ids.studentIds } });
  if (ids.rosterIds.length > 0) branches.push({ rosterId: { in: ids.rosterIds } });
  return branches.length > 0 ? { NOT: { OR: branches } } : {};
}
