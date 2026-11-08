import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";
import {
  DEPED_JHS_WEIGHTS,
  computeFinalGrade,
} from "../src/services/grading.js";
import type { ComponentType } from "../src/generated/prisma/client.js";

/**
 * Seeds a five-subject gradebook for the Reogie (G7) advisory section and locks
 * every student's final grade for all terms as `adviser_approved`.
 *
 * Purpose: give the adviser's grading workspace + the Bama "SF10 Auto-fill"
 * flow real, complete data (all three terms approved → every subject fills).
 *
 * Learners are keyed by `studentId` when they have a StudentProfile and by
 * `rosterId` when they are roster-only, matching the dual-identity rules.
 *
 * Idempotent: components/assignments upsert, missing scores are added, and
 * final grades are recomputed + re-locked. Run with "--dry-run" to preview.
 */

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });
const DRY = process.argv.includes("--dry-run");

const SECTION_NAME = "Reogie";
const SUBJECTS = [
  { code: "MATH7", name: "Math 7", weights: "MATH" as const },
  { code: "ENG7", name: "English 7", weights: "LANG" as const },
  { code: "SCI7", name: "Science 7", weights: "MATH" as const },
  { code: "FIL7", name: "Filipino 7", weights: "LANG" as const },
  { code: "AP7", name: "Araling Panlipunan 7", weights: "LANG" as const },
];

const COMPONENTS: { type: ComponentType; titles: string[]; max: number }[] = [
  { type: "WRITTEN_WORK", titles: ["Quiz 1", "Quiz 2"], max: 50 },
  { type: "PERFORMANCE_TASK", titles: ["Task 1", "Task 2"], max: 100 },
  { type: "EXAM", titles: ["Midterm", "Finals"], max: 100 },
];

type WeightProfile = "LANG" | "MATH";

const WEIGHTS: Record<WeightProfile, { WRITTEN_WORK: number; PERFORMANCE_TASK: number; EXAM: number }> = {
  // Languages / AP / EsP
  LANG: { ...DEPED_JHS_WEIGHTS[0].weights },
  // Math & Science
  MATH: { ...DEPED_JHS_WEIGHTS[1].weights },
};

function hash01(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** Target term rating per learner+subject, then jitter each assessment around it. */
function targetPct(key: string): number {
  const r = hash01(key);
  if (r < 0.6) return 88 + r * (10 / 0.6); // 88–98
  if (r < 0.85) return 80 + ((r - 0.6) / 0.25) * 8; // 80–88
  return 76 + ((r - 0.85) / 0.15) * 4; // 76–80
}

function assessmentPct(studentKey: string, asmKey: string, base: number): number {
  const jitter = hash01(`${studentKey}::${asmKey}`) * 8 - 3; // -3..+5
  return Math.min(100, Math.max(70, Math.round((base + jitter) * 10) / 10));
}

function termDate(termStart: Date | null, termIndex: number, offset: number): Date {
  const base = termStart ? new Date(termStart) : new Date();
  base.setDate(base.getDate() + offset + termIndex);
  base.setHours(9, 0, 0, 0);
  return base;
}

async function main() {
  const section = await prisma.section.findFirst({
    where: { name: SECTION_NAME, gradeLevel: "G7" },
    select: { id: true, name: true, gradeLevel: true, schoolYearId: true, adviserId: true },
  });
  if (!section) throw new Error(`Section "${SECTION_NAME}" (G7) not found.`);
  if (!section.adviserId) throw new Error(`Section "${SECTION_NAME}" has no adviser.`);
  const adviserId = section.adviserId;

  const schoolYear = await prisma.schoolYear.findFirst({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  if (!schoolYear) throw new Error("No active school year — run the base seed first.");

  const terms = await prisma.term.findMany({
    where: { schoolYearId: schoolYear.id },
    orderBy: { termNumber: "asc" },
    select: { id: true, termNumber: true, startDate: true },
  });
  if (terms.length === 0) throw new Error("No terms for the active school year.");

  const roster = await prisma.studentRoster.findMany({
    where: { sectionId: section.id },
    orderBy: { lrn: "asc" },
    select: { id: true, lrn: true, fullName: true, gradeLevel: true },
  });
  if (roster.length === 0) throw new Error(`Section "${SECTION_NAME}" has no roster entries.`);

  const profiles = await prisma.studentProfile.findMany({
    where: { lrn: { in: roster.map((r) => r.lrn) } },
    select: { userId: true, lrn: true },
  });
  const profileByLrn = new Map(profiles.map((p) => [p.lrn, p.userId]));

  const learners = roster.map((r) => ({
    rosterId: r.id,
    lrn: r.lrn,
    name: r.fullName,
    studentId: profileByLrn.get(r.lrn) ?? null,
  }));

  console.log(
    `${section.name} G7 · ${schoolYear.name} · ${terms.length} term(s) · ${learners.length} learner(s)` +
      ` (${learners.filter((l) => l.studentId).length} with account, ${learners.filter((l) => !l.studentId).length} roster-only)`,
  );

  // Resolve (or create) the five subjects.
  const subjectRows: { id: string; code: string; name: string; weights: WeightProfile }[] = [];
  for (const s of SUBJECTS) {
    let row = await prisma.subject.findUnique({
      where: { code_gradeLevel: { code: s.code, gradeLevel: "G7" } },
      select: { id: true, code: true, name: true },
    });
    if (!row) {
      if (DRY) {
        console.log(`  [dry] would create subject ${s.code} · ${s.name}`);
        subjectRows.push({ id: `dry-${s.code}`, code: s.code, name: s.name, weights: s.weights });
        continue;
      }
      row = await prisma.subject.create({
        data: { code: s.code, name: s.name, gradeLevel: "G7" },
        select: { id: true, code: true, name: true },
      });
      console.log(`  + created subject ${row.code} · ${row.name}`);
    }
    subjectRows.push({ ...row, weights: s.weights });
  }

  const stats = {
    components: 0,
    assessments: 0,
    scores: 0,
    finals: 0,
    assignments: 0,
  };

  for (const subject of subjectRows) {
    const weights = WEIGHTS[subject.weights];

    for (const [termIndex, term] of terms.entries()) {
      // ---- Assignment (the adviser owns these five for this section) ----
      if (!DRY) {
        await prisma.teacherSubjectAssignment.upsert({
          where: {
            teacherId_subjectId_sectionId_termId: {
              teacherId: adviserId,
              subjectId: subject.id,
              sectionId: section.id,
              termId: term.id,
            },
          },
          update: {},
          create: {
            teacherId: adviserId,
            subjectId: subject.id,
            sectionId: section.id,
            termId: term.id,
          },
        });
        stats.assignments++;
      }

      // ---- Components ----
      const componentIds: { id: string; type: ComponentType }[] = [];
      for (const c of COMPONENTS) {
        if (DRY) {
          componentIds.push({ id: `dry-${subject.code}-${term.termNumber}-${c.type}`, type: c.type });
          continue;
        }
        const comp = await prisma.gradeComponent.upsert({
          where: {
            subjectId_termId_componentType: {
              subjectId: subject.id,
              termId: term.id,
              componentType: c.type,
            },
          },
          update: { weightPercentage: weights[c.type] },
          create: {
            subjectId: subject.id,
            termId: term.id,
            componentType: c.type,
            weightPercentage: weights[c.type],
          },
          select: { id: true },
        });
        componentIds.push({ id: comp.id, type: c.type });
        stats.components++;
      }

      // ---- Assessments (one section-scoped set per subject/term) ----
      const assessments: { id: string; type: ComponentType; title: string; max: number; order: number }[] = [];
      let order = 0;
      for (const c of COMPONENTS) {
        const compId = componentIds.find((x) => x.type === c.type)!.id;
        for (const title of c.titles) {
          order += 1;
          if (DRY) {
            assessments.push({
              id: `dry-${subject.code}-${term.termNumber}-${c.type}-${title}`,
              type: c.type,
              title,
              max: c.max,
              order,
            });
            continue;
          }
          const existing = await prisma.assessment.findFirst({
            where: { gradeComponentId: compId, sectionId: section.id, title },
            select: { id: true, maxScore: true },
          });
          if (existing) {
            assessments.push({ id: existing.id, type: c.type, title, max: existing.maxScore, order });
            continue;
          }
          const created = await prisma.assessment.create({
            data: {
              gradeComponentId: compId,
              sectionId: section.id,
              title,
              maxScore: c.max,
              dateGiven: termDate(term.startDate, termIndex, order * 5),
              createdBy: adviserId,
            },
            select: { id: true, maxScore: true },
          });
          assessments.push({ id: created.id, type: c.type, title, max: created.maxScore, order });
          stats.assessments++;
        }
      }

      // ---- Scores for every learner ----
      for (const learner of learners) {
        const learnerKey = learner.studentId ?? learner.rosterId;
        const base = targetPct(`${learnerKey}::${subject.id}::${term.id}`);

        const scoreRows: {
          assessmentId: string;
          studentId: string | null;
          rosterId: string | null;
          rawScore: number;
          percentageScore: number;
        }[] = [];
        for (const asm of assessments) {
          const pct = assessmentPct(learnerKey, asm.id, base);
          scoreRows.push({
            assessmentId: asm.id,
            studentId: learner.studentId,
            rosterId: learner.studentId ? null : learner.rosterId,
            rawScore: Math.round((pct / 100) * asm.max * 10) / 10,
            percentageScore: pct,
          });
        }

        if (!DRY) {
          const existing = await prisma.studentGrade.findMany({
            where: {
              assessmentId: { in: assessments.map((a) => a.id) },
              OR: learner.studentId
                ? [{ studentId: learner.studentId }]
                : [{ rosterId: learner.rosterId }],
            },
            select: { assessmentId: true },
          });
          const taken = new Set(existing.map((e) => e.assessmentId));
          const fresh = scoreRows.filter((s) => !taken.has(s.assessmentId));
          if (fresh.length > 0) {
            const res = await prisma.studentGrade.createMany({ data: fresh, skipDuplicates: true });
            stats.scores += res.count;
          }
        }

        // ---- Final grade: weighted average → DepEd transmutation ----
        const componentAverages = COMPONENTS.map((c) => {
          const rows = scoreRows.filter((s) => assessments.find((a) => a.id === s.assessmentId)!.type === c.type);
          const average = rows.length > 0 ? rows.reduce((sum, r) => sum + r.percentageScore, 0) / rows.length : 0;
          return { weightPercentage: weights[c.type], average };
        });
        const final = computeFinalGrade(componentAverages);

        if (!DRY) {
          const existing = await prisma.finalGrade.findFirst({
            where: {
              subjectId: subject.id,
              termId: term.id,
              OR: [
                ...(learner.studentId ? [{ studentId: learner.studentId }] : []),
                { rosterId: learner.rosterId },
              ],
            },
            select: { id: true },
          });
          const data = {
            computedAverage: Math.round(final.computedAverage * 100) / 100,
            transmutedGrade: final.transmutedGrade,
            remarks: final.remarks,
            lockStatus: "adviser_approved" as const,
            lockedBy: adviserId,
            lockedAt: new Date(),
            adviserApprovedBy: adviserId,
            adviserApprovedAt: new Date(),
          };
          if (existing) {
            await prisma.finalGrade.update({ where: { id: existing.id }, data });
          } else {
            await prisma.finalGrade.create({
              data: {
                studentId: learner.studentId,
                rosterId: learner.studentId ? null : learner.rosterId,
                subjectId: subject.id,
                termId: term.id,
                ...data,
              },
            });
          }
          stats.finals++;
        }
      }
    }

    console.log(
      `  ${subject.code} · ${subject.name} — ${terms.length} term(s), ${learners.length} learner(s)` +
        (DRY ? " [dry]" : ""),
    );
  }

  console.log(
    DRY
      ? "[dry] no writes performed"
      : `done: assignments=${stats.assignments}, components=${stats.components}, assessments=${stats.assessments}, scores=${stats.scores}, finals=${stats.finals} (all adviser_approved)`,
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
