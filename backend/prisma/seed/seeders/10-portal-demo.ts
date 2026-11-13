import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import argon2 from "argon2";
import { DRY, STUDENT_PASSWORD, PARENT_PASSWORD, T2_CUTOFF } from "../config.js";
import type { CoreCtx } from "./00-core.js";
import type { AcademicCtx } from "./01-academic.js";

/**
 * Fixed demo accounts for the student/parent mobile portals.
 *
 * The bulk roster seeder mints accounts with generated emails/LRNs, which is
 * great for volume but useless for demos. These four accounts are stable and
 * documented in README/AGENTS:
 *
 *   student@zentra.test         Student2025!   G7
 *   parent@zentra.test          Parent2025!    linked to the G7 learner
 *   student.senior@zentra.test  Student2025!   G11
 *   parent.senior@zentra.test   Parent2025!    linked to the G11 learner
 *   parent.unlinked@zentra.test Parent2025!    no child link (empty state)
 */
const LEARNER_LRN = "990000000001";
const SENIOR_LRN = "990000000002";

function isoDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function weekdayBack(from: Date, count: number): Date[] {
  const out: Date[] = [];
  const d = new Date(from);
  while (out.length < count) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) out.push(isoDay(d));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out.reverse();
}

export async function seedPortalDemo(
  prisma: PrismaClient,
  core: CoreCtx,
  acad: AcademicCtx,
): Promise<void> {
  if (DRY) {
    console.log("Portal demo: skipped (dry run)");
    return;
  }

  const g7 = acad.sections.find((s) => s.gradeLevel === "G7");
  const g11 = acad.sections.find((s) => s.gradeLevel === "G11");
  if (!g7 || !g11) {
    console.warn("Portal demo: no G7/G11 section found, skipping");
    return;
  }
  const term2 = core.termIds.find((t) => t.n === 2) ?? core.termIds[0];
  const term1 = core.termIds.find((t) => t.n === 1) ?? core.termIds[0];

  const studentHash = await argon2.hash(STUDENT_PASSWORD);
  const parentHash = await argon2.hash(PARENT_PASSWORD);

  async function upsertUser(email: string, fullName: string, role: "student" | "parent", passwordHash: string) {
    return prisma.user.upsert({
      where: { email },
      update: { fullName, role, passwordHash, status: "active" },
      create: { email, fullName, role, passwordHash, status: "active" },
    });
  }

  const g7Student = await upsertUser("student@zentra.test", "Demo Learner (G7)", "student", studentHash);
  const g11Student = await upsertUser("student.senior@zentra.test", "Demo Learner (G11)", "student", studentHash);
  const g7Parent = await upsertUser("parent@zentra.test", "Demo Parent (G7)", "parent", parentHash);
  const g11Parent = await upsertUser("parent.senior@zentra.test", "Demo Parent (G11)", "parent", parentHash);
  await upsertUser("parent.unlinked@zentra.test", "Demo Parent (unlinked)", "parent", parentHash);

  for (const [user, lrn, gradeLevel, section] of [
    [g7Student, LEARNER_LRN, "G7", g7],
    [g11Student, SENIOR_LRN, "G11", g11],
  ] as const) {
    await prisma.studentProfile.upsert({
      where: { userId: user.id },
      update: { lrn, gradeLevel: gradeLevel as never, sectionId: section.id },
      create: {
        userId: user.id,
        lrn,
        gradeLevel: gradeLevel as never,
        sectionId: section.id,
        birthdate: new Date("2012-05-14T00:00:00Z"),
        gender: "Female",
        address: "123 Demo St., Quezon City",
        mascot: "fox",
      },
    });
    await prisma.studentRoster.upsert({
      where: { lrn_schoolYearId: { lrn, schoolYearId: core.syId } },
      update: { fullName: user.fullName, gradeLevel: gradeLevel as never, sectionId: section.id },
      create: {
        lrn,
        fullName: user.fullName,
        gradeLevel: gradeLevel as never,
        sectionId: section.id,
        schoolYearId: core.syId,
      },
    });
  }

  for (const [parent, student, relationship] of [
    [g7Parent, g7Student, "Mother"],
    [g11Parent, g11Student, "Father"],
  ] as const) {
    await prisma.parentProfile.upsert({
      where: { userId: parent.id },
      update: {},
      create: { userId: parent.id, occupation: "Demo occupation", address: "123 Demo St., Quezon City" },
    });
    await prisma.parentStudentLink.upsert({
      where: { parentId_studentId: { parentId: parent.id, studentId: student.id } },
      update: { relationship },
      create: {
        parentId: parent.id,
        studentId: student.id,
        relationship,
        approvedBy: g7.adviserId,
      },
    });
  }

  // Grades for both terms so the term-history picker has something to show.
  const subjectsFor = (gradeLevel: string) =>
    acad.subjects.filter((s) => s.gradeLevel === gradeLevel);

  for (const [student, gradeLevel] of [
    [g7Student, "G7"],
    [g11Student, "G11"],
  ] as const) {
    const subjects = subjectsFor(gradeLevel);
    for (const [idx, subject] of subjects.entries()) {
      for (const term of [term1, term2]) {
        const base = 78 + ((idx * 3 + term.n) % 14);
        const transmuted = Math.min(98, base);
        await prisma.finalGrade.upsert({
          where: { studentId_subjectId_termId: { studentId: student.id, subjectId: subject.id, termId: term.id } },
          update: { computedAverage: base, transmutedGrade: transmuted, remarks: transmuted >= 75 ? "Passed" : "Failed", lockStatus: "adviser_approved" },
          create: {
            studentId: student.id,
            subjectId: subject.id,
            termId: term.id,
            computedAverage: base,
            transmutedGrade: transmuted,
            remarks: transmuted >= 75 ? "Passed" : "Failed",
            lockStatus: "adviser_approved",
            adviserApprovedBy: g7.adviserId,
            adviserApprovedAt: new Date(),
          },
        });
      }
    }
  }

  // Attendance for term 2: last 12 school days before the seed cutoff.
  const days = weekdayBack(T2_CUTOFF, 12);
  const recordedBy = g7.adviserId;
  for (const [student, gradeLevel, section] of [
    [g7Student, "G7", g7],
    [g11Student, "G11", g11],
  ] as const) {
    const subjects = subjectsFor(gradeLevel);
    for (const [sIdx, subject] of subjects.entries()) {
      for (const [dIdx, date] of days.entries()) {
        const status = dIdx === 3 && sIdx === 1 ? "absent" : dIdx === 6 && sIdx === 2 ? "late" : "present";
        await prisma.attendanceRecord.upsert({
          where: {
            studentId_subjectId_date_slot: {
              studentId: student.id,
              subjectId: subject.id,
              date,
              slot: 1,
            },
          },
          update: { status },
          create: {
            studentId: student.id,
            sectionId: section.id,
            date,
            session: "AM",
            status,
            recordedBy,
            termId: term2.id,
            subjectId: subject.id,
            slot: 1,
          },
        });
      }
    }
  }

  // Advisory modules: one submitted, one overdue for each demo section.
  const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  for (const section of [g7, g11]) {
    const module = await prisma.advisoryModule.upsert({
      where: { id: `demo-module-${section.gradeLevel}` },
      update: {},
      create: {
        id: `demo-module-${section.gradeLevel}`,
        sectionId: section.id,
        kind: "adm",
        moduleName: `Demo Module — ${section.gradeLevel}`,
        moduleUrl: "https://example.com/demo-module",
        description: "Seeded demo module for the mobile portal.",
        releaseDate: past,
        dueDate: future,
        createdBy: section.adviserId,
      },
    });
    const overdue = await prisma.advisoryModule.upsert({
      where: { id: `demo-module-overdue-${section.gradeLevel}` },
      update: {},
      create: {
        id: `demo-module-overdue-${section.gradeLevel}`,
        sectionId: section.id,
        kind: "adm",
        moduleName: `Demo Overdue Module — ${section.gradeLevel}`,
        moduleUrl: "https://example.com/demo-overdue",
        description: "Seeded overdue module for the mobile portal.",
        releaseDate: past,
        dueDate: past,
        createdBy: section.adviserId,
      },
    });
    const learner = section.gradeLevel === "G7" ? g7Student : g11Student;
    await prisma.advisoryModuleSubmission.upsert({
      where: { moduleId_studentId: { moduleId: module.id, studentId: learner.id } },
      update: {},
      create: {
        moduleId: module.id,
        studentId: learner.id,
        submissionKind: "link",
        submissionUrl: "https://example.com/answered-demo",
        submitted: true,
        submittedAt: past,
        recordedBy: section.adviserId,
      },
    });
    void overdue;
  }

  // Seed one notification for each portal user so the inbox isn't empty.
  for (const user of [g7Student, g11Student, g7Parent, g11Parent]) {
    const existing = await prisma.notification.findFirst({
      where: { userId: user.id, sourceTable: "advisory_modules" },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "module_released",
        sourceTable: "advisory_modules",
        sourceId: `demo-module-${user.id === g7Student.id || user.id === g7Parent.id ? "G7" : "G11"}`,
        channel: ["web", "mobile"],
        message: "A new learning module is now available.",
      },
    });
  }

  console.log("Portal demo accounts ready: student@, parent@, *.senior@, parent.unlinked@");
}
