import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";
import { recomputeRisk } from "../src/services/risk.js";
import argon2 from "argon2";

// Targeted demo seed: ONE student engineered to trip exactly the academic +
// attendance engine flags (High risk = 2 flags), so they show up on the
// guidance interventions queue needing intervention.
//
// - Final grades average below 75  -> academic flag
// - Almost no "present" attendance -> attendance flag (present / enrolled < 0.8)
// - Zero anecdotal records          -> behavioral flag stays off
//
// Idempotent: fixed email/LRN, scoped deletes, then recomputeRisk() writes a
// fresh RiskSnapshot and auto-creates the guidance intervention when none is
// open. Run with: npx tsx prisma/seed-low-academic-attendance.ts

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

// Row 1 reuses the legacy demo account from the first run so the page holds
// exactly 5 rows across re-runs.
const DEMO_STUDENTS = [1, 2, 3, 4, 5].map((n) => ({
  email: n === 1 ? "student.demolow@zentra.test" : `student.demolow${n}@zentra.test`,
  fullName: `Demo Low Academic ${n}`,
  lrn: `2099900000${n}`,
}));

async function main() {
  const schoolYear = await prisma.schoolYear.findFirst({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  if (!schoolYear) throw new Error("No active school year — run the main seed first (npx tsx prisma/seed.ts).");

  const term = await prisma.term.findFirst({
    where: { schoolYearId: schoolYear.id },
    orderBy: { termNumber: "asc" },
    select: { id: true, termNumber: true },
  });
  if (!term) throw new Error("No terms found — run the main seed first.");

  // Prefer G7-A so the demo sits with the main seed cohort; else first section.
  const section =
    (await prisma.section.findFirst({
      where: { schoolYearId: schoolYear.id, name: "G7-A" },
      select: { id: true, name: true, gradeLevel: true, adviserId: true },
    })) ??
    (await prisma.section.findFirst({
      where: { schoolYearId: schoolYear.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, gradeLevel: true, adviserId: true },
    }));
  if (!section) throw new Error("No sections found — run the main seed first.");
  if (!section.adviserId) throw new Error(`Section ${section.name} has no adviser.`);

  const subjects = await prisma.subject.findMany({
    where: { gradeLevel: section.gradeLevel },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });
  if (subjects.length === 0) throw new Error(`No subjects for ${section.gradeLevel} — run the main seed first.`);

  const studentHash = await argon2.hash("Student2025!");
  const termStart = new Date("2026-06-20T08:00:00");
  // Low-grade bands per demo student (all averages well below 75).
  const gradeBands: number[][] = [
    [70, 71, 72, 73],
    [68, 69, 70, 71],
    [71, 72, 73, 74],
    [69, 70, 71, 72],
    [70, 72, 71, 73],
  ];

  for (let n = 0; n < DEMO_STUDENTS.length; n++) {
    const demo = DEMO_STUDENTS[n];
    const user = await prisma.user.upsert({
      where: { email: demo.email },
      update: { fullName: demo.fullName, role: "student", passwordHash: studentHash, status: "active" },
      create: { email: demo.email, fullName: demo.fullName, role: "student", passwordHash: studentHash, status: "active" },
    });
    await prisma.studentProfile.upsert({
      where: { userId: user.id },
      update: { lrn: demo.lrn, gradeLevel: section.gradeLevel, sectionId: section.id },
      create: {
        userId: user.id,
        lrn: demo.lrn,
        gradeLevel: section.gradeLevel,
        sectionId: section.id,
        gender: n % 2 === 0 ? "Male" : "Female",
        address: "Demo address, Quezon City",
      },
    });

    // Reset this student's term data so re-runs stay deterministic.
    await prisma.finalGrade.deleteMany({ where: { studentId: user.id, termId: term.id } });
    await prisma.attendanceRecord.deleteMany({ where: { studentId: user.id, termId: term.id } });
    await prisma.anecdotalRecord.deleteMany({ where: { studentId: user.id, termId: term.id } });

    // Low grades in every subject: average well below 75.
    const band = gradeBands[n % gradeBands.length];
    await prisma.finalGrade.createMany({
      data: subjects.map((s, i) => {
        const g = band[i % band.length];
        return {
          studentId: user.id,
          subjectId: s.id,
          termId: term.id,
          computedAverage: g,
          transmutedGrade: g,
          remarks: "Failed",
          lockStatus: "unlocked",
        };
      }),
    });

    // Poor attendance: a handful of absences, zero presences.
    await prisma.attendanceRecord.createMany({
      data: [0, 1, 2, 3, 4].map((d) => ({
        studentId: user.id,
        sectionId: section.id,
        date: new Date(termStart.getTime() + (d + n) * 86_400_000),
        session: d % 2 === 0 ? "AM" : "PM",
        status: "absent",
        recordedBy: section.adviserId!,
        termId: term.id,
      })),
    });

    // Engine recompute: writes the RiskSnapshot (detection date) and
    // auto-creates the approved, ongoing guidance intervention.
    const result = await recomputeRisk(user.id, term.id);
    const snapshot = await prisma.riskSnapshot.findFirst({
      where: { studentId: user.id, termId: term.id },
      orderBy: { snapshotDate: "desc" },
      select: { snapshotDate: true, riskLevel: true, riskCount: true },
    });
    const intervention = await prisma.intervention.findFirst({
      where: { studentId: user.id, outcomeStatus: { not: "resolved" } },
      orderBy: { assignedAt: "desc" },
      select: { id: true, outcomeStatus: true, approvalStatus: true },
    });

    console.log(`Seeded [${n + 1}/5]: ${demo.fullName} (${demo.lrn}) — ${result.riskLevel} (${result.riskCount} flags), detected ${snapshot?.snapshotDate?.toISOString() ?? "—"}, follow-up ${intervention ? `${intervention.approvalStatus}/${intervention.outcomeStatus}` : "none"}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
