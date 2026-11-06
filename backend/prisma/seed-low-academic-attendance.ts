import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";
import { recomputeRisk } from "../src/services/risk.js";
import argon2 from "argon2";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

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

    // This seed used to delete-then-reinsert the demo rows on every run. Postgres
    // keeps the dead tuple of every deleted/rewritten row until a VACUUM FULL, so
    // re-running it repeatedly was the main source of the table bloat we found
    // (AttendanceRecord at ~87 KB and FinalGrade at ~126 KB per *live* row on a
    // 500 MB free-tier DB). Upserting in place keeps the physical size flat.
    // The prior anecdotalRecord.deleteMany() was removed too: nothing ever creates
    // anecdotal records for these five demo users, so it only deleted 0 rows.
    const band = gradeBands[n % gradeBands.length];
    for (const [i, s] of subjects.entries()) {
      const g = band[i % band.length];
      const data = {
        computedAverage: g,
        transmutedGrade: g,
        remarks: "Failed" as const,
        lockStatus: "unlocked" as const,
      };
      await prisma.finalGrade.upsert({
        where: { studentId_subjectId_termId: { studentId: user.id, subjectId: s.id, termId: term.id } },
        update: data,
        create: { studentId: user.id, subjectId: s.id, termId: term.id, ...data },
      });
    }

    // AttendanceRecord's compound uniques include { studentId, subjectId, date, slot }
    // and subjectId/slot are nullable here (legacy AM/PM rows). Postgres treats NULLs
    // as distinct, so an upsert would never match the existing legacy row and would
    // keep appending. Match on the legacy identity explicitly instead.
    const attendanceRows = [0, 1, 2, 3, 4].map((d) => ({
      studentId: user.id,
      sectionId: section.id,
      date: new Date(termStart.getTime() + (d + n) * 86_400_000),
      session: (d % 2 === 0 ? "AM" : "PM") as "AM" | "PM",
      status: "absent" as const,
      recordedBy: section.adviserId!,
      termId: term.id,
    }));

    for (const row of attendanceRows) {
      const existing = await prisma.attendanceRecord.findFirst({
        where: {
          studentId: row.studentId,
          termId: row.termId,
          date: row.date,
          session: row.session,
          subjectId: null,
        },
        select: { id: true },
      });
      if (existing) {
        await prisma.attendanceRecord.update({ where: { id: existing.id }, data: row });
      } else {
        await prisma.attendanceRecord.create({ data: row });
      }
    }

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
