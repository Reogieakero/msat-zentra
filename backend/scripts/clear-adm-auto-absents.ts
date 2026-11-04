/**
 * One-off cleanup: remove synthesized absences for learners whose ADM case is
 * signed by the Principal (attendance-exempt).
 *
 * The auto-absent sweep never deletes rows, so absences created before the
 * signature stay behind and would keep the learner's rate/risk low. This walks
 * every term, finds exempt learners, and reports (then optionally deletes) the
 * sweep's `absent` rows for them.
 *
 * Dry-run by default:
 *   npx tsx scripts/clear-adm-auto-absents.ts
 * Apply:
 *   npx tsx scripts/clear-adm-auto-absents.ts --apply
 *
 * Teacher-written rows are never touched: only `recordedBy =
 * "system:auto-absent"` rows are considered.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

const APPLY = process.argv.includes("--apply");
const EXEMPT_STAGES = ["enrollment_monitoring", "completion"];

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

async function main() {
  const terms = await prisma.term.findMany({
    select: { id: true, termNumber: true, schoolYearId: true, schoolYear: { select: { name: true } } },
    orderBy: [{ schoolYear: { name: "asc" } }, { termNumber: "asc" }],
  });

  let totalRows = 0;
  for (const term of terms) {
    // Latest ADM case per learner, mirroring services/adm/attendancePolicy.ts
    // (keep the predicate in sync if the policy changes).
    const cases = await prisma.admLearnerProfile.findMany({
      select: {
        studentId: true,
        approvedBy: true,
        returnedAt: true,
        stage: true,
        createdAt: true,
        term: { select: { schoolYearId: true, startDate: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const termRow = await prisma.term.findUnique({
      where: { id: term.id },
      select: { schoolYearId: true, startDate: true },
    });
    const exempt = new Set<string>();
    const seen = new Set<string>();
    for (const c of cases) {
      if (seen.has(c.studentId)) continue;
      seen.add(c.studentId);
      if (!c.approvedBy || c.returnedAt) continue;
      if (!EXEMPT_STAGES.includes(c.stage)) continue;
      const sameYear = c.term?.schoolYearId === termRow?.schoolYearId;
      const notFuture =
        !c.term?.startDate ||
        !termRow?.startDate ||
        c.term.startDate.getTime() <= termRow.startDate.getTime();
      if (sameYear && notFuture) exempt.add(c.studentId);
    }

    if (exempt.size === 0) continue;

    const where = {
      termId: term.id,
      recordedBy: "system:auto-absent",
      status: "absent" as const,
      studentId: { in: [...exempt] },
    };
    const count = await prisma.attendanceRecord.count({ where });
    if (count === 0) continue;

    totalRows += count;
    const label = `${term.schoolYear.name} T${term.termNumber}`;
    if (APPLY) {
      const deleted = await prisma.attendanceRecord.deleteMany({ where });
      console.log(`${label}: deleted ${deleted.count} auto-absent rows (${exempt.size} exempt learners)`);
    } else {
      console.log(`${label}: would delete ${count} auto-absent rows (${exempt.size} exempt learners)`);
    }
  }

  console.log(
    APPLY
      ? `Done. Removed ${totalRows} synthesized absences.`
      : `Dry run. ${totalRows} rows would be removed. Re-run with --apply to delete.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
