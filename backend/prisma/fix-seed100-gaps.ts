import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });
const DRY = process.argv.includes("--dry-run");

function hash01(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}
function pctFor(studentKey: string, asmKey: string): number {
  const r = hash01(`${studentKey}::${asmKey}`);
  if (r < 0.7) return 82 + r * (17 / 0.7);
  if (r < 0.85) return 75 + ((r - 0.7) / 0.15) * 6.9;
  return 60 + ((r - 0.85) / 0.15) * 14.9;
}

async function main() {
  // ---- 1. student grades: fill missing (assessment x rosterInGrade) with auto ids ----
  const assessments = await prisma.assessment.findMany({
    select: { id: true, maxScore: true, gradeComponent: { select: { subject: { select: { gradeLevel: true } } } }, studentGrades: { select: { rosterId: true } } },
  });
  const sections = await prisma.section.findMany({ select: { gradeLevel: true, rosterEntries: { select: { id: true } } } });
  const rosterByGrade = new Map<string, { id: string }[]>();
  for (const s of sections) { const a = rosterByGrade.get(s.gradeLevel) ?? []; a.push(...s.rosterEntries); rosterByGrade.set(s.gradeLevel, a); }

  let missingTotal = 0;
  for (const a of assessments) {
    const students = rosterByGrade.get(a.gradeComponent.subject.gradeLevel) ?? [];
    const graded = new Set(a.studentGrades.map(g => g.rosterId));
    missingTotal += students.filter(s => !graded.has(s.id)).length;
  }
  console.log(`studentGrades missing=${missingTotal} across ${assessments.length} assessments`);
  let filled = 0;
  if (!DRY && missingTotal > 0) {
    for (const a of assessments) {
      const students = rosterByGrade.get(a.gradeComponent.subject.gradeLevel) ?? [];
      const graded = new Set((await prisma.studentGrade.findMany({ where: { assessmentId: a.id }, select: { rosterId: true } })).map(g => g.rosterId));
      const miss = students.filter(s => !graded.has(s.id));
      if (!miss.length) continue;
      // NOTE: no `id` — let DB default uuid() avoid slice-collision bug in seed-100-topup
      const rows = miss.map(s => {
        const pct = Math.round(pctFor(s.id, a.id) * 10) / 10;
        return { assessmentId: a.id, rosterId: s.id, rawScore: Math.round(((pct / 100) * a.maxScore) * 10) / 10, percentageScore: pct };
      });
      for (let i = 0; i < rows.length; i += 1000) {
        const res = await prisma.studentGrade.createMany({ data: rows.slice(i, i + 1000), skipDuplicates: true });
        filled += res.count;
      }
    }
  }
  console.log(DRY ? `dry-run: would fill ${missingTotal}` : `filled studentGrades=${filled}`);

  // ---- 2. risk snapshots to 840+ ----
  const rsHave = await prisma.riskSnapshot.count();
  const rsNeed = Math.max(0, 840 - rsHave);
  console.log(`riskSnapshots have=${rsHave} need=${rsNeed}`);
  if (!DRY && rsNeed > 0) {
    const t1 = await prisma.term.findFirst({ where: { schoolYear: { isActive: true }, termNumber: 1 } });
    const roster = await prisma.studentRoster.findMany({ select: { id: true } });
    const existing = new Set((await prisma.riskSnapshot.findMany({ where: { termId: t1!.id }, select: { rosterId: true } })).map(r => r.rosterId));
    const rows: any[] = [];
    for (const r of roster) {
      if (rows.length >= rsNeed) break;
      if (existing.has(r.id)) continue;
      const roll = hash01(`rsfix_${r.id}`);
      const cnt = roll < 0.7 ? 0 : roll < 0.9 ? 1 : 2;
      rows.push({ rosterId: r.id, riskLevel: (cnt >= 2 ? "High" : cnt === 1 ? "Moderate" : "Low") as const, riskCount: cnt, termId: t1!.id });
    }
    for (let i = 0; i < rows.length; i += 500) await prisma.riskSnapshot.createMany({ data: rows.slice(i, i + 500), skipDuplicates: true });
    console.log(`riskSnapshots added=${Math.min(rows.length, rsNeed)}`);
  }

  // ---- 3. teacher term grants to 100 ----
  const gHave = await prisma.teacherTermGrant.count();
  const gNeed = Math.max(0, 100 - gHave);
  console.log(`termGrants have=${gHave} need=${gNeed}`);
  if (!DRY && gNeed > 0) {
    const pool = await prisma.user.findMany({ where: { role: { in: ["subject_teacher", "adviser"] } }, select: { id: true } });
    const terms = await prisma.term.findMany({ select: { id: true } });
    const exist = new Set((await prisma.teacherTermGrant.findMany({ select: { userId: true, termId: true } })).map(e => `${e.userId}::${e.termId}`));
    const rows: any[] = [];
    outer: for (const u of pool) for (const t of terms) {
      if (rows.length >= gNeed) break outer;
      if (exist.has(`${u.id}::${t.id}`)) continue;
      exist.add(`${u.id}::${t.id}`);
      rows.push({ userId: u.id, termId: t.id, via: "adviser" });
    }
    // if still short (pool*terms < 100), create extra teachers first
    if (rows.length < gNeed) console.log(`WARN: pool ${pool.length}x${terms.length}=${pool.length * terms.length} max, can only add ${rows.length}`);
    for (let i = 0; i < rows.length; i += 500) await prisma.teacherTermGrant.createMany({ data: rows.slice(i, i + 500), skipDuplicates: true });
    console.log(`termGrants added=${rows.length}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
