import "dotenv/config";
import { PrismaClient, LockStatus, GradeLevel } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

const GRADE_BAND: GradeLevel[] = ["G7", "G8", "G9", "G10"];

async function main() {
  const year = await prisma.schoolYear.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!year) { console.log("no active school year"); process.exit(1); }

  const term = await prisma.term.findFirst({ where: { schoolYearId: year.id }, select: { id: true } });
  if (!term) { console.log("no term"); process.exit(1); }

  const sections = await prisma.section.findMany({
    where: { gradeLevel: { in: GRADE_BAND }, schoolYearId: year.id },
    select: { id: true, gradeLevel: true, name: true, adviserId: true },
  });

  const subjects = await prisma.subject.findMany({
    where: { gradeLevel: { in: GRADE_BAND } },
    select: { id: true, code: true, gradeLevel: true, name: true },
  });

  const subjectByGrade: Record<string, typeof subjects> = {};
  for (const s of subjects) {
    const key = s.gradeLevel;
    if (!subjectByGrade[key]) subjectByGrade[key] = [];
    subjectByGrade[key].push(s);
  }

  const students = await prisma.user.findMany({
    where: { role: "student", studentProfile: { gradeLevel: { in: GRADE_BAND } } },
      include: { studentProfile: { select: { lrn: true, gradeLevel: true, sectionId: true } } },
  });

  console.log(`Seeding record-keeper final grades for ${students.length} G7–10 students...`);

  let completeCount = 0;
  let lockedCount = 0;
  let unlockedCount = 0;

  for (const user of students) {
    const profile = user.studentProfile;
    if (!profile) continue;

    const gradeSubjects = subjectByGrade[profile.gradeLevel] || [];
    const existing = await prisma.finalGrade.findMany({
      where: { studentId: user.id, termId: term.id },
      select: { id: true, subjectId: true },
    });

    const existingSubjIds = new Set(existing.map((e) => e.subjectId));
    const missing = gradeSubjects.filter((s) => !existingSubjIds.has(s.id));

    const rand = Math.random();
    let targetStatus: LockStatus;
    if (rand < 0.6) {
      targetStatus = "adviser_approved";
      completeCount++;
    } else if (rand < 0.85) {
      targetStatus = "locked";
      lockedCount++;
    } else {
      targetStatus = "unlocked";
      unlockedCount++;
    }

    const toCreate: any[] = [];
    for (const subj of missing) {
      const avg = Math.floor(Math.random() * 15) + 75;
      toCreate.push({
        id: `fg_rk_${user.id}_${subj.id}_${term.id}`,
        studentId: user.id,
        subjectId: subj.id,
        termId: term.id,
        computedAverage: avg,
        transmutedGrade: avg,
        remarks: avg >= 75 ? "Passed" : "Failed",
        lockStatus: targetStatus,
        adviserApprovedAt: targetStatus === "adviser_approved" ? new Date() : null,
      });
    }

    if (toCreate.length > 0) {
      await prisma.finalGrade.createMany({ data: toCreate, skipDuplicates: true });
    }

    if (existing.length > 0 && targetStatus === "adviser_approved") {
      await prisma.finalGrade.updateMany({
        where: { studentId: user.id, termId: term.id },
        data: { lockStatus: "adviser_approved", adviserApprovedAt: new Date() },
      });
    } else if (existing.length > 0 && targetStatus === "locked") {
      await prisma.finalGrade.updateMany({
        where: { studentId: user.id, termId: term.id, lockStatus: "unlocked" },
        data: { lockStatus: "locked" },
      });
    }
  }

  // Ensure teacher assignments exist for record-keeper band (needed for detail page teacher column)
  const existingAssignments = await prisma.teacherSubjectAssignment.findMany({
    where: { sectionId: { in: sections.map((s) => s.id) }, termId: term.id },
    select: { id: true },
  });

  if (existingAssignments.length === 0) {
    const tsa: any[] = [];
    for (const sec of sections) {
      const gradeSubjs = subjectByGrade[sec.gradeLevel] || [];
      for (const subj of gradeSubjs) {
        tsa.push({
          id: `tsa_rk_${sec.id}_${subj.id}_${term.id}`,
          teacherId: sec.adviserId,
          subjectId: subj.id,
          sectionId: sec.id,
          termId: term.id,
        });
      }
    }
    if (tsa.length > 0) {
      await prisma.teacherSubjectAssignment.createMany({ data: tsa, skipDuplicates: true });
      console.log(`Created ${tsa.length} teacher assignments for record-keeper band.`);
    }
  }

  console.log(`Record-keeper final grades seed complete:
  - Complete sets (adviser_approved): ${completeCount}
  - Locked sets: ${lockedCount}
  - Unlocked sets: ${unlockedCount}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
