import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

/**
 * Full per-subject gradebook seed for the active term.
 * - 3 components per subject (Written Work 20 / Performance Task 40 / Exam 40).
 * - 2 assessments per component, owned by the section-subject teacher.
 * - Scores for EVERY roster student in each section offering the subject,
 *   with a realistic curve (~15% below 75 to feed at-risk views).
 * - FinalGrade per student x subject, averaged from their own scores
 *   (coherent with the academics/risk/honor-roll pages); mixed lockStatus.
 * - Idempotent: component/assignment upserts on their uniques; assessments
 *   skipped by (componentId, title); grades skip existing pairs.
 * - Usage: `npx tsx prisma/seed-gradebook-full.ts [--dry-run]`
 */

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });
const DRY = process.argv.includes("--dry-run");

const COMPONENTS = [
  { type: "WRITTEN_WORK" as const, weight: 20, titles: ["Quiz 1", "Quiz 2"], max: 50 },
  { type: "PERFORMANCE_TASK" as const, weight: 40, titles: ["Task 1", "Task 2"], max: 100 },
  { type: "EXAM" as const, weight: 40, titles: ["Midterm", "Finals"], max: 100 },
];

// Deterministic pseudo-random per (student, assessment) so reruns are stable.
function hash01(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}
// Curve: ~70% strong (82-99), ~15% mid (75-81), ~15% weak (60-74).
function pctFor(studentKey: string, asmKey: string): number {
  const r = hash01(`${studentKey}::${asmKey}`);
  if (r < 0.7) return 82 + r * (17 / 0.7);
  if (r < 0.85) return 75 + ((r - 0.7) / 0.15) * 6.9;
  return 60 + ((r - 0.85) / 0.15) * 14.9;
}
function inTermDate(seed: number): Date {
  const start = new Date(2026, 5, 20, 7, 0, 0).getTime();
  const end = Math.min(Date.now(), new Date(2026, 9, 31, 23, 59, 59).getTime());
  return new Date(start + ((seed * 7919) % Math.max(1, end - start)));
}

async function main() {
  // Active term; prefer the term that already holds grade components so new
  // rows join the existing gradebook instead of forking a second one.
  const compTerms = await prisma.gradeComponent.groupBy({ by: ["termId"], _count: { _all: true } });
  let termId: string;
  if (compTerms.length > 0) {
    compTerms.sort((a, b) => b._count._all - a._count._all);
    termId = compTerms[0].termId;
  } else {
    const t =
      (await prisma.term.findFirst({
        where: { schoolYear: { isActive: true } },
        orderBy: { termNumber: "asc" },
      })) ?? (await prisma.term.findFirstOrThrow());
    termId = t.id;
  }
  console.log(`term,${termId}`);

  const subjects = await prisma.subject.findMany({
    select: { id: true, code: true, gradeLevel: true },
    orderBy: [{ gradeLevel: "asc" }, { code: "asc" }],
  });
  const sections = await prisma.section.findMany({
    select: { id: true, name: true, gradeLevel: true, rosterEntries: { select: { id: true } } },
  });
  const teachers = await prisma.user.findMany({
    where: { role: { in: ["subject_teacher", "adviser"] } },
    select: { id: true },
  });
  if (teachers.length === 0) throw new Error("No teachers/advisers to own gradebooks");

  const stats = { components: 0, assessments: 0, grades: 0, finals: 0, skipped: 0 };

  for (const [si, subj] of subjects.entries()) {
    const gradeSections = sections.filter(
      (s) => s.gradeLevel === subj.gradeLevel && s.rosterEntries.length > 0,
    );
    if (gradeSections.length === 0) continue;

    // 1. Components (upsert on unique).
    const compIds: { id: string; type: string; max: number }[] = [];
    let missingComps = 0;
    for (const c of COMPONENTS) {
      if (DRY) {
        const ex = await prisma.gradeComponent.findUnique({
          where: { subjectId_termId_componentType: { subjectId: subj.id, termId, componentType: c.type } },
          select: { id: true },
        });
        if (ex) {
          compIds.push({ id: ex.id, type: c.type, max: c.max });
          continue;
        } else {
          missingComps++;
          continue;
        }
      } else {
        const comp = await prisma.gradeComponent.upsert({
          where: {
            subjectId_termId_componentType: { subjectId: subj.id, termId, componentType: c.type },
          },
          update: { weightPercentage: c.weight },
          create: { subjectId: subj.id, termId, componentType: c.type, weightPercentage: c.weight },
          select: { id: true },
        });
        compIds.push({ id: comp.id, type: c.type, max: c.max });
        stats.components++;
      }
    }
    if (DRY) {
      const students = gradeSections.reduce((n, s) => n + s.rosterEntries.length, 0);
      console.log(
        `${subj.code},sections=${gradeSections.length},students=${students},missingComponents=${missingComps},plannedAssessments~=${(compIds.length + missingComps) * 2},plannedGrades~=${students * (compIds.length + missingComps) * 2}`,
      );
      continue;
    }

    // 2. Teacher assignment per section (upsert on unique), round-robin owner.
    for (const [gi, sec] of gradeSections.entries()) {
      const owner = teachers[(si + gi) % teachers.length];
      await prisma.teacherSubjectAssignment.upsert({
        where: {
          teacherId_subjectId_sectionId_termId: {
            teacherId: owner.id,
            subjectId: subj.id,
            sectionId: sec.id,
            termId,
          },
        },
        update: {},
        create: { teacherId: owner.id, subjectId: subj.id, sectionId: sec.id, termId },
      });
    }

    // 3. Assessments: 2 per component (skip existing titles).
    const existingTitles = new Set(
      (
        await prisma.assessment.findMany({
          where: { gradeComponentId: { in: compIds.map((c) => c.id) } },
          select: { gradeComponentId: true, title: true },
        })
      ).map((a) => `${a.gradeComponentId}::${a.title}`),
    );
    const asmRows: { id: string; compId: string; title: string; max: number; owner: string }[] = [];
    for (const c of compIds) {
      const def = COMPONENTS.find((d) => d.type === c.type)!;
      for (const title of def.titles) {
        if (existingTitles.has(`${c.id}::${title}`)) continue;
        const owner = teachers[(si + title.length) % teachers.length];
        asmRows.push({
          id: `gb_a_${subj.code}_${c.type}_${title.replace(/\s/g, "")}`.slice(0, 60),
          compId: c.id,
          title,
          max: def.max,
          owner: owner.id,
        });
      }
    }
    // Short-id collisions across subjects are possible after the 60-char cut;
    // fall back to uuid on conflict by inserting one by one ignoring dupes.
    const asmIdByKey = new Map<string, { id: string; max: number }>();
    for (const [ai, a] of asmRows.entries()) {
      const id = `${a.id}_${ai}`.slice(-60);
      try {
        const created = await prisma.assessment.create({
          data: {
            id,
            gradeComponentId: a.compId,
            title: a.title,
            maxScore: a.max,
            dateGiven: inTermDate(si * 100 + ai),
            createdBy: a.owner,
          },
          select: { id: true, maxScore: true },
        });
        asmIdByKey.set(`${a.compId}::${a.title}`, { id: created.id, max: created.maxScore });
        stats.assessments++;
      } catch {
        stats.skipped++;
      }
    }
    // Include pre-existing assessments of these components.
    const allAsm = await prisma.assessment.findMany({
      where: { gradeComponentId: { in: compIds.map((c) => c.id) } },
      select: { id: true, maxScore: true, gradeComponentId: true, title: true },
    });
    for (const a of allAsm) {
      if (!asmIdByKey.has(`${a.gradeComponentId}::${a.title}`)) {
        asmIdByKey.set(`${a.gradeComponentId}::${a.title}`, { id: a.id, max: a.maxScore });
      }
    }

    // 4. Scores for every roster student in each section.
    const gradeBatch: {
      id: string;
      assessmentId: string;
      rosterId: string;
      rawScore: number;
      percentageScore: number;
    }[] = [];
    // Per (student, subject) accumulator for coherent finals.
    const subjScores = new Map<string, number[]>();
    for (const sec of gradeSections) {
      for (const r of sec.rosterEntries) {
        for (const c of compIds) {
          const def = COMPONENTS.find((d) => d.type === c.type)!;
          for (const title of def.titles) {
            const asm = asmIdByKey.get(`${c.id}::${title}`);
            if (!asm) continue;
            const pct = Math.round(pctFor(r.id, asm.id) * 10) / 10;
            gradeBatch.push({
              // Subject-scoped id; roster SUFFIX (topup20_* ids share a prefix).
              id: `gb_g_${subj.code}_${c.type}_${title.replace(/\s/g, "")}_${r.id.slice(-8)}`.slice(0, 60),
              assessmentId: asm.id,
              rosterId: r.id,
              rawScore: Math.round(((pct / 100) * asm.max * 10)) / 10,
              percentageScore: pct,
            });
            const arr = subjScores.get(r.id) ?? [];
            arr.push(pct);
            subjScores.set(r.id, arr);
          }
        }
      }
    }
    // Insert in chunks; skip pairs that already exist.
    const CHUNK = 1000;
    for (let i = 0; i < gradeBatch.length; i += CHUNK) {
      const chunk = gradeBatch.slice(i, i + CHUNK);
      const existing = await prisma.studentGrade.findMany({
        where: {
          OR: chunk.map((g) => ({ assessmentId: g.assessmentId, rosterId: g.rosterId })),
        },
        select: { assessmentId: true, rosterId: true },
      });
      const taken = new Set(existing.map((e) => `${e.assessmentId}::${e.rosterId}`));
      const fresh = chunk.filter((g) => !taken.has(`${g.assessmentId}::${g.rosterId}`));
      // De-dupe ids inside the chunk (60-char cut can collide).
      const seen = new Set<string>();
      const deduped = fresh.filter((g) => {
        if (seen.has(g.id)) return false;
        seen.add(g.id);
        return true;
      });
      if (deduped.length > 0) {
        // skipDuplicates guards cross-chunk id collisions from short ids.
        const res = await prisma.studentGrade.createMany({ data: deduped, skipDuplicates: true });
        stats.grades += res.count;
        stats.skipped += chunk.length - res.count;
      } else {
        stats.skipped += chunk.length;
      }
    }

    // 5. FinalGrade per student x subject from their own scores.
    const finalBatch = [];
    let fi = 0;
    for (const [rosterId, pcts] of subjScores) {
      if (pcts.length === 0) continue;
      const avg = Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10;
      const lockRoll = hash01(`${rosterId}::${subj.id}::lock`);
      finalBatch.push({
        id: `gb_f_${subj.code}_${rosterId.slice(0, 8)}_${fi++}`.slice(0, 60),
        rosterId,
        subjectId: subj.id,
        termId,
        computedAverage: avg,
        transmutedGrade: Math.round(avg),
        remarks: (avg >= 75 ? "Passed" : "Failed") as "Passed" | "Failed",
        lockStatus: (lockRoll < 0.6 ? "unlocked" : lockRoll < 0.85 ? "locked" : "adviser_approved") as
          | "unlocked"
          | "locked"
          | "adviser_approved",
      });
    }
    for (let i = 0; i < finalBatch.length; i += CHUNK) {
      const chunk = finalBatch.slice(i, i + CHUNK);
      const existing = await prisma.finalGrade.findMany({
        where: { OR: chunk.map((g) => ({ rosterId: g.rosterId, subjectId: g.subjectId, termId })) },
        select: { rosterId: true, subjectId: true },
      });
      const taken = new Set(existing.map((e) => `${e.rosterId}::${e.subjectId}`));
      const fresh = chunk.filter((g) => !taken.has(`${g.rosterId}::${g.subjectId}`));
      if (fresh.length > 0) {
        const res = await prisma.finalGrade.createMany({ data: fresh, skipDuplicates: true });
        stats.finals += res.count;
        stats.skipped += chunk.length - res.count;
      } else {
        stats.skipped += chunk.length;
      }
    }
  }

  console.log(
    `gradebook done: components upserted=${stats.components}, assessments created=${stats.assessments}, grades=${stats.grades}, finals=${stats.finals}, skipped=${stats.skipped}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
