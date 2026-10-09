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

  const [staleProfiles, staleRosters] = await Promise.all([
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
  ]);

  let profiles = 0;
  for (const p of staleProfiles) {
    try {
      await recomputeRisk(p.userId, termId);
      profiles += 1;
    } catch (err) {
      logger.warn({ err, studentId: p.userId }, "Risk refresh failed for profile");
    }
  }
  let rosters = 0;
  for (const r of staleRosters) {
    try {
      await recomputeRosterRisk(r.id, termId);
      rosters += 1;
    } catch (err) {
      logger.warn({ err, rosterId: r.id }, "Risk refresh failed for roster entry");
    }
  }

  const pruned = await prisma.riskSnapshot.deleteMany({
    where: { snapshotDate: { lt: new Date(Date.now() - RETENTION_MS) } },
  });

  return { profiles, rosters, pruned: pruned.count };
}
