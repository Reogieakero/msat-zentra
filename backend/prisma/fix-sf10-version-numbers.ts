import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

/**
 * One-off repair for SF10 records whose version history has duplicate
 * `versionNumber` rows (or a `currentVersion` that lags behind the versions).
 *
 * Cause: the upload path created versions with `count + 1` but never updated
 * `Sf10Record.currentVersion`, so a later auto-fill/manual correction reused an
 * existing number. The code is fixed; this script renumbers the affected
 * records in `changedAt` order and syncs `currentVersion`.
 *
 * Dry-run by default. Pass `--apply` to write. Safe to re-run.
 */

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });
const APPLY = process.argv.includes("--apply");

async function main() {
  const records = await prisma.sf10Record.findMany({
    select: {
      id: true,
      currentVersion: true,
      student: { select: { user: { select: { fullName: true } } } },
      versions: {
        orderBy: [{ versionNumber: "asc" }, { changedAt: "asc" }],
        select: { id: true, versionNumber: true, changeReason: true, changedAt: true },
      },
    },
  });

  let touched = 0;
  for (const record of records) {
    const numbers = record.versions.map((v) => v.versionNumber);
    const unique = new Set(numbers);
    const needsRenumber = unique.size !== numbers.length;
    const needsSync =
      record.versions.length > 0 && record.currentVersion !== record.versions.length;
    if (!needsRenumber && !needsSync) continue;

    touched += 1;
    console.log(
      `${APPLY ? "" : "[dry] "}${record.student.user.fullName}: currentVersion=${record.currentVersion}` +
        ` versions=[${record.versions.map((v) => v.versionNumber).join(", ")}]`,
    );

    if (!APPLY) continue;

    const ordered = [...record.versions].sort(
      (a, b) => a.changedAt.getTime() - b.changedAt.getTime() || a.versionNumber - b.versionNumber,
    );
    await prisma.$transaction(async (tx) => {
      for (const [i, v] of ordered.entries()) {
        const next = i + 1;
        if (v.versionNumber !== next) {
          await tx.sf10RecordVersion.update({ where: { id: v.id }, data: { versionNumber: next } });
        }
      }
      await tx.sf10Record.update({
        where: { id: record.id },
        data: { currentVersion: ordered.length },
      });
    });
    console.log(`  -> renumbered to [${ordered.map((_, i) => i + 1).join(", ")}], currentVersion=${ordered.length}`);
  }

  console.log(
    `${APPLY ? "done" : "[dry] no writes performed"}: ${touched} record(s) ${APPLY ? "repaired" : "need repair"}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
