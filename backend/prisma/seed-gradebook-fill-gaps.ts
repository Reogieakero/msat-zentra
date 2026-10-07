import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

/**
 * Fills scores for legacy assessments (pre-gradebook seed) so EVERY
 * assessment has grades for every roster student in its subject's grade.
 * Same deterministic curve as seed-gradebook-full.ts. Idempotent:
 * skips existing (assessmentId, rosterId) pairs.
 * Usage: `npx tsx prisma/seed-gradebook-fill-gaps.ts [--dry-run]`
 */

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });
const DRY = process.argv.includes("--dry-run");

function hash01(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}
function pctFor(studentKey: string, asmKey: string): number {
  const r = hash01(`${studentKey}::${asmKey}`);
  if (r < 0.7) return 82 + r * (17 / 0.7);
  if (r < 0.85) return 75 + ((r - 0.7) / 0.15) * 6.9;
  return 60 + ((r - 0.85) / 0.15) * 14.9;
}

async function main() {
  const assessments = await prisma.assessment.findMany({
    select: {
      id: true,
      maxScore: true,
      gradeComponent: { select: { subject: { select: { code: true, gradeLevel: true } } } },
      studentGrades: { select: { rosterId: true } },
    },
  });
  const sections = await prisma.section.findMany({
    select: { gradeLevel: true, rosterEntries: { select: { id: true } } },
  });
  const rosterByGrade = new Map<string, { id: string }[]>();
  for (const s of sections) {
    const arr = rosterByGrade.get(s.gradeLevel) ?? [];
    arr.push(...s.rosterEntries);
    rosterByGrade.set(s.gradeLevel, arr);
  }

  let filled = 0;
  let already = 0;
  for (const a of assessments) {
    const students = rosterByGrade.get(a.gradeComponent.subject.gradeLevel) ?? [];
    const graded = new Set(a.studentGrades.map((g) => g.rosterId));
    const missing = students.filter((s) => !graded.has(s.id));
    if (missing.length === 0) {
      already++;
      continue;
    }
    if (DRY) {
      filled += missing.length;
      continue;
    }
    const rows = missing.map((s, i) => {
      const pct = Math.round(pctFor(s.id, a.id) * 10) / 10;
      return {
        // Short unique id (long two-uuid ids collide at the 60-char cut).
        id: `gb_f_${a.id.slice(-10)}_${s.id.slice(-10)}_${i}`.slice(0, 60),
        assessmentId: a.id,
        rosterId: s.id,
        rawScore: Math.round(((pct / 100) * a.maxScore * 10)) / 10,
        percentageScore: pct,
      };
    });
    // De-dupe ids inside the batch.
    const seen = new Set<string>();
    const deduped = rows.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
    const res = await prisma.studentGrade.createMany({ data: deduped, skipDuplicates: true });
    filled += res.count;
  }
  console.log(DRY ? `dry-run: ${filled} scores would be added` : `filled ${filled} scores; ${already} assessments already full`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
