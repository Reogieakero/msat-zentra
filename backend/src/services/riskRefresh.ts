import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/pino.js";
import { resolveActiveTermId } from "../lib/term-resolve.js";
import { recomputeRisk, recomputeRosterRisk } from "./risk.js";

const BATCH_CAP = 200;
const SNAPSHOT_FRESH_MS = 24 * 3_600_000;
const RETENTION_MS = 90 * 24 * 3_600_000;

export async function refreshRiskSnapshots(): Promise<{ profiles: number; rosters: number; pruned: number }> {
  const termId = await resolveActiveTermId();
  if (!termId) return { profiles: 0, rosters: 0, pruned: 0 };
  const freshSince = new Date(Date.now() - SNAPSHOT_FRESH_MS);

  const [staleProfiles, staleRosters, newProfiles, newRosters] = await Promise.all([
    prisma.studentProfile.findMany({
      where: {
        section: { schoolYear: { isActive: true } },
        NOT: { riskSnapshots: { some: { termId, snapshotDate: { gte: freshSince } } } },
      },
      select: { userId: true },
      take: BATCH_CAP,
    }),
    prisma.studentRoster.findMany({
      where: {
        schoolYear: { isActive: true },
        NOT: { riskSnapshots: { some: { termId, snapshotDate: { gte: freshSince } } } },
      },
      select: { id: true },
      take: BATCH_CAP,
    }),
    // Learners with no snapshot at all this term. The engine only writes on a
    // flag flip, so a learner whose risk never changed would stay invisible to
    // the term's charts — force one baseline row per learner per term.
    prisma.studentProfile.findMany({
      where: {
        section: { schoolYear: { isActive: true } },
        riskSnapshots: { none: { termId } },
      },
      select: { userId: true },
      take: BATCH_CAP,
    }),
    prisma.studentRoster.findMany({
      where: {
        schoolYear: { isActive: true },
        riskSnapshots: { none: { termId } },
      },
      select: { id: true },
      take: BATCH_CAP,
    }),
  ]);

  const profileWork = new Map<string, boolean>();
  for (const p of newProfiles) profileWork.set(p.userId, true);
  for (const p of staleProfiles) {
    if (!profileWork.has(p.userId)) profileWork.set(p.userId, false);
  }
  const rosterWork = new Map<string, boolean>();
  for (const r of newRosters) rosterWork.set(r.id, true);
  for (const r of staleRosters) {
    if (!rosterWork.has(r.id)) rosterWork.set(r.id, false);
  }

  let profiles = 0;
  for (const [userId, forceSnapshot] of profileWork) {
    try {
      await recomputeRisk(userId, termId, { forceSnapshot });
      profiles += 1;
    } catch (err) {
      logger.warn({ err, studentId: userId }, "Risk refresh failed for profile");
    }
  }
  let rosters = 0;
  for (const [rosterId, forceSnapshot] of rosterWork) {
    try {
      await recomputeRosterRisk(rosterId, termId, { forceSnapshot });
      rosters += 1;
    } catch (err) {
      logger.warn({ err, rosterId }, "Risk refresh failed for roster entry");
    }
  }

  const pruned = await prisma.riskSnapshot.deleteMany({
    where: { snapshotDate: { lt: new Date(Date.now() - RETENTION_MS) } },
  });

  return { profiles, rosters, pruned: pruned.count };
}
