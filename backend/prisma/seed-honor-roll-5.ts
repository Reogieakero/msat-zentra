import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

/**
 * Seeds five Grade 7 honor-roll candidates for the principal Honor Roll page
 * (/principal/honor-roll, live source: GET /api/academics/honor-roll-live).
 *
 * The live honor roll is computed from StudentGrade rows in the term the
 * principal desk resolves (active school year → date-picked term). Students
 * are enlisted as StudentRoster rows (no login account needed) inside a Grade 7
 * section, with high scores across five subjects so each meets the DO 15
 * Academic Excellence rule (general average ≥ 90, no subject below 80).
 *
 * Idempotent: matching section / roster / components / assessments are reused
 * and grades are inserted with skipDuplicates.
 */

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

const STUDENTS = [
  { lrn: "136701000001", fullName: "Althea Marie D. Bautista", offset: 0 },
  { lrn: "136701000002", fullName: "Juan Miguel S. Dela Cruz", offset: 0.8 },
  { lrn: "136701000003", fullName: "Sophia Grace L. Reyes", offset: 1.6 },
  { lrn: "136701000004", fullName: "Nathan Paul C. Villanueva", offset: 2.2 },
  { lrn: "136701000005", fullName: "Isabella Rose M. Santiago", offset: 3.1 },
];

const SUBJECTS = [
  { code: "FIL7", name: "Filipino", base: 97 },
  { code: "ENG7", name: "English", base: 96 },
  { code: "MATH7", name: "Mathematics", base: 95 },
  { code: "SCI7", name: "Science", base: 94 },
  { code: "AP7", name: "Araling Panlipunan", base: 93 },
];

const COMPONENTS = [
  { type: "WRITTEN_WORK" as const, weight: 20, title: "Honor WW" },
  { type: "PERFORMANCE_TASK" as const, weight: 40, title: "Honor PT" },
  { type: "EXAM" as const, weight: 40, title: "Honor Exam" },
];

/** Same date-based resolution the API uses for non-teacher roles. */
function pickCurrentTerm<T extends { startDate: Date | null; endDate: Date | null }>(
  terms: T[],
): T | null {
  if (terms.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  const day = (d: Date | null, fallback: string) =>
    d ? d.toISOString().slice(0, 10) : fallback;
  return (
    terms.find(
      (t) =>
        day(t.startDate, "0000-01-01") <= today &&
        today <= day(t.endDate, "9999-12-31"),
    ) ?? terms[0]!
  );
}

async function main() {
  const year = await prisma.schoolYear.findFirst({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      terms: {
        orderBy: { termNumber: "asc" },
        select: { id: true, termNumber: true, startDate: true, endDate: true },
      },
    },
  });
  if (!year) throw new Error("No active school year — seed the school first.");
  const term = pickCurrentTerm(year.terms);
  if (!term) throw new Error(`Active school year ${year.name} has no terms.`);

  const section =
    (await prisma.section.findFirst({
      where: { schoolYearId: year.id, gradeLevel: "G7" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    })) ??
    (await prisma.section.create({
      data: {
        name: "Grade 7 - Sampaguita",
        gradeLevel: "G7",
        schoolYearId: year.id,
      },
      select: { id: true, name: true },
    }));

  const roster = [];
  for (const s of STUDENTS) {
    roster.push(
      await prisma.studentRoster.upsert({
        where: { lrn_schoolYearId: { lrn: s.lrn, schoolYearId: year.id } },
        update: {
          fullName: s.fullName,
          gradeLevel: "G7",
          sectionId: section.id,
        },
        create: {
          lrn: s.lrn,
          fullName: s.fullName,
          gradeLevel: "G7",
          sectionId: section.id,
          schoolYearId: year.id,
        },
        select: { id: true },
      }),
    );
  }

  const owner = await prisma.user.findFirst({
    where: { role: { in: ["principal", "adviser", "subject_teacher"] } },
    select: { id: true },
  });
  const createdBy = owner?.id ?? "seed-honor-roll";

  let gradesCreated = 0;
  for (const [si, subject] of SUBJECTS.entries()) {
    const dbSubject = await prisma.subject.upsert({
      where: { code_gradeLevel: { code: subject.code, gradeLevel: "G7" } },
      update: { name: subject.name },
      create: {
        code: subject.code,
        name: subject.name,
        gradeLevel: "G7",
        category: "CORE",
      },
      select: { id: true },
    });

    for (const component of COMPONENTS) {
      const dbComponent = await prisma.gradeComponent.upsert({
        where: {
          subjectId_termId_componentType: {
            subjectId: dbSubject.id,
            termId: term.id,
            componentType: component.type,
          },
        },
        update: { weightPercentage: component.weight },
        create: {
          subjectId: dbSubject.id,
          termId: term.id,
          componentType: component.type,
          weightPercentage: component.weight,
        },
        select: { id: true },
      });

      const assessment =
        (await prisma.assessment.findFirst({
          where: {
            gradeComponentId: dbComponent.id,
            sectionId: section.id,
            title: component.title,
          },
          select: { id: true },
        })) ??
        (await prisma.assessment.create({
          data: {
            gradeComponentId: dbComponent.id,
            sectionId: section.id,
            title: component.title,
            maxScore: 100,
            dateGiven: term.startDate ?? new Date(),
            createdBy,
          },
          select: { id: true },
        }));

      const rows = STUDENTS.map((student, index) => {
        // Every score stays in the 89–97 band: safely above 80 per subject and
        // comfortably above the 90 general-average cutoff.
        const percentage =
          Math.round((subject.base + (si % 2 === 0 ? 0 : 0.5) - student.offset) * 10) / 10;
        return {
          assessmentId: assessment.id,
          rosterId: roster[index]!.id,
          rawScore: percentage,
          percentageScore: percentage,
        };
      });
      const created = await prisma.studentGrade.createMany({
        data: rows,
        skipDuplicates: true,
      });
      gradesCreated += created.count;
    }
  }

  console.log(
    `honor roll seeded: ${STUDENTS.length} students in ${section.name} (${year.name}, Term ${term.termNumber}), grades inserted=${gradesCreated}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
