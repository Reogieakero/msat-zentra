import "dotenv/config";
import argon2 from "argon2";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";
import { mascotForUnique, sectionTakenMascots } from "../src/services/mascot.js";

/**
 * Seeds five Newton (G7) learners as ADM-enrolled learners inside
 * teacher.noload@zentra.test's class, so the attendance-exemption behavior is
 * visible in the teacher workspace.
 *
 * Newton is seeded roster-only (no StudentProfile rows), and an ADM case needs
 * a real account (`AdmLearnerProfile.studentId`), so each target is provisioned
 * from its StudentRoster row first. Each case ends up with:
 *   - a registered StudentProfile (active, known password for demo login),
 *   - an anecdotal record + ADM referral endorsed to the ADM coordinator,
 *   - an AdmLearnerProfile at `enrollment_monitoring`, signed by the Principal,
 *   - verified evidence forms and a few AdmModule rows.
 *
 * Exemption predicate: services/adm/attendancePolicy.ts — `approvedBy` set,
 * stage enrollment_monitoring|completion, `returnedAt` null.
 *
 * Idempotent: learners that already have a signed case for the term are left
 * alone (only missing forms/modules are topped up). Pass `--reset` to delete
 * the seeded Newton ADM cases first.
 */

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

const SECTION_NAME = "Newton";
const TEACHER_EMAIL = "teacher.noload@zentra.test";
const LEARNER_COUNT = 5;
const LEARNER_PASSWORD = "Zentra2025!";
const LEARNER_EMAIL_DOMAIN = "newton-adm.zentra.test";

const REASONS = [
  "ADM consultation — chronic absenteeism (12 days this term); needs home-based modular learning.",
  "ADM consultation — working student; needs flexible modular delivery with weekly module tracking.",
  "ADM consultation — prolonged illness; doctor advised home-based learning for the rest of the term.",
  "ADM consultation — family relocation; learner cannot attend in person but can continue modular work.",
  "ADM consultation — repeated truancy; guardian requested modular learning with coordinator monitoring.",
];

const INCIDENTS = [
  "Student missed 12 class days this term without excuse letters; guardian unreachable by phone.",
  "Student reports working evenings to support the family and stopped submitting outputs.",
  "Medical certificate on file for a four-week recovery period; classroom attendance not advised.",
  "Family moved to another barangay; daily travel to school is no longer feasible.",
  "Student was absent for two straight weeks after repeated tardiness; guardian asked for modular setup.",
];

const MODULES = [
  "Module 1 · Araling Panlipunan",
  "Module 2 · Edukasyon sa Pagpapakatao",
  "Module 3 · English",
  "Module 4 · Mathematics",
];

const FORM_TITLES: Record<string, string> = {
  REFERRAL_FORM: "GCForm-03 · ADM Referral Form",
  ANECDOTAL_REPORT: "Anecdotal Report",
  CERTIFICATION: "Recommendation & Certification",
};

function daysAgo(n: number, hour = 9): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function main() {
  const section = await prisma.section.findFirst({
    where: { name: SECTION_NAME },
    select: { id: true, name: true, gradeLevel: true, schoolYearId: true, adviserId: true },
  });
  if (!section) throw new Error(`Section "${SECTION_NAME}" not found — run prisma:sections-scientists16 first.`);

  const teacher = await prisma.user.findUnique({
    where: { email: TEACHER_EMAIL },
    select: { id: true, fullName: true },
  });
  if (!teacher) throw new Error(`Missing teacher account ${TEACHER_EMAIL} — run prisma:seed:teacher-unassigned first.`);

  const schoolYear = await prisma.schoolYear.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  if (!schoolYear) throw new Error("No active school year — run the base seed first.");

  // Same term the teacher desk resolves: the term covering today.
  const terms = await prisma.term.findMany({
    where: { schoolYearId: schoolYear.id },
    select: { id: true, termNumber: true, startDate: true, endDate: true },
    orderBy: { termNumber: "asc" },
  });
  const now = new Date();
  const term =
    terms.find((t) => t.startDate && t.endDate && t.startDate <= now && now <= t.endDate) ??
    terms.find((t) => t.termNumber === 2) ??
    terms[0];
  if (!term) throw new Error("No term found for the active school year.");

  const byEmail = async (email: string) => {
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true, fullName: true } });
    if (!u) throw new Error(`Missing staff account ${email} — run the base seed first.`);
    return u;
  };
  const adm = await byEmail("adm@zentra.test");
  const principal = await byEmail("principal@zentra.test");

  // Prove the teacher actually owns a class in this section for the term.
  const assignments = await prisma.teacherSubjectAssignment.findMany({
    where: { teacherId: teacher.id, sectionId: section.id, termId: term.id },
    select: { id: true, subject: { select: { name: true, code: true } } },
  });
  if (assignments.length === 0) {
    throw new Error(
      `${TEACHER_EMAIL} has no ${SECTION_NAME} assignment in term ${term.termNumber} — run prisma:schedule-scientists first.`,
    );
  }

  const rosters = await prisma.studentRoster.findMany({
    where: { sectionId: section.id, schoolYearId: schoolYear.id },
    select: { id: true, lrn: true, fullName: true, gradeLevel: true },
    orderBy: { lrn: "asc" },
    take: LEARNER_COUNT,
  });
  if (rosters.length < LEARNER_COUNT) {
    throw new Error(
      `Expected ${LEARNER_COUNT} ${SECTION_NAME} roster learners, found ${rosters.length} — run prisma:sections-scientists16 first.`,
    );
  }

  const reset = process.argv.includes("--reset");
  if (reset) {
    const existing = await prisma.admLearnerProfile.findMany({
      where: { student: { sectionId: section.id } },
      select: { id: true, referralId: true },
    });
    if (existing.length > 0) {
      const referralIds = existing.map((p) => p.referralId);
      const anecdotalIds = (
        await prisma.referral.findMany({
          where: { id: { in: referralIds } },
          select: { anecdotalRecordId: true },
        })
      ).map((r) => r.anecdotalRecordId);
      await prisma.admLearnerProfile.deleteMany({ where: { id: { in: existing.map((p) => p.id) } } });
      await prisma.referral.deleteMany({ where: { id: { in: referralIds } } });
      await prisma.anecdotalRecord.deleteMany({ where: { id: { in: anecdotalIds } } });
      console.log(`Reset: removed ${existing.length} ${SECTION_NAME} ADM case(s).`);
    }
  }

  const passwordHash = await argon2.hash(LEARNER_PASSWORD);
  const takenMascots = await sectionTakenMascots(prisma, section.id);
  const report: string[] = [];

  for (const [index, roster] of rosters.entries()) {
    // ---- 1. Registered learner (provisioned from the roster) ----
    let profile = await prisma.studentProfile.findUnique({
      where: { lrn: roster.lrn },
      select: { userId: true },
    });
    if (!profile) {
      const email = `${roster.lrn}@${LEARNER_EMAIL_DOMAIN}`;
      const created = await prisma.user.upsert({
        where: { email },
        update: { fullName: roster.fullName, status: "active", passwordHash },
        create: {
          email,
          passwordHash,
          role: "student",
          fullName: roster.fullName,
          lrn: roster.lrn,
          status: "active",
        },
        select: { id: true },
      });
      const mascot = mascotForUnique(roster.fullName, roster.lrn, takenMascots);
      takenMascots.add(mascot);
      await prisma.studentProfile.create({
        data: {
          userId: created.id,
          lrn: roster.lrn,
          gradeLevel: roster.gradeLevel,
          sectionId: section.id,
          mascot,
        },
      });
      await prisma.studentRoster.update({ where: { id: roster.id }, data: { mascot } });
      profile = { userId: created.id };
    } else {
      await prisma.studentProfile.update({
        where: { userId: profile.userId },
        data: { sectionId: section.id },
      });
      await prisma.user.update({
        where: { id: profile.userId },
        data: { fullName: roster.fullName },
      });
    }
    const studentId = profile.userId;

    // ---- 2. Anecdotal record + endorsed ADM referral ----
    let referral = await prisma.referral.findFirst({
      where: { studentId, referredToRole: "adm_coordinator", status: { not: "dismissed" } },
      select: { id: true },
      orderBy: { id: "desc" },
    });
    if (!referral) {
      const anecdotal = await prisma.anecdotalRecord.create({
        data: {
          studentId,
          rosterId: null,
          observerId: teacher.id,
          sectionId: section.id,
          observationDatetime: daysAgo(18 - index, 8),
          descriptionOfIncident: INCIDENTS[index % INCIDENTS.length],
          descriptionOfLocation: "Classroom",
          notesRecommendationsActions:
            "Recommend ADM consultation: verify home situation and set up modular learning with module tracking.",
          classPerformance: "Falling behind on outputs due to missed lessons.",
          attendanceSummary: "Repeated absences this term.",
          category: "attendance",
          confidentialityLevel: "restricted",
          termId: term.id,
        },
        select: { id: true },
      });
      referral = await prisma.referral.create({
        data: {
          anecdotalRecordId: anecdotal.id,
          referredToRole: "adm_coordinator",
          referredBy: teacher.id,
          reason: REASONS[index % REASONS.length],
          consultReviewer: "guidance_counselor",
          consultReviewedAt: daysAgo(16 - index, 10),
          referralFormReady: true,
          status: "in_progress",
          studentId,
          rosterId: null,
          termId: term.id,
        },
        select: { id: true },
      });
    }

    // ---- 3. Principal-signed ADM case (the attendance-exemption switch) ----
    let admProfile = await prisma.admLearnerProfile.findFirst({
      where: { referralId: referral.id },
      select: { id: true },
    });
    if (!admProfile) {
      admProfile = await prisma.admLearnerProfile.create({
        data: {
          studentId,
          referralId: referral.id,
          termId: term.id,
          stage: "enrollment_monitoring",
          eligibilityStatus: "eligible",
          preparedBy: adm.id,
          approvedBy: principal.id,
          approvedAt: daysAgo(12 - index, 11),
          certificationDetails: {
            recommendation: "Home-based modular learning with weekly module tracking.",
            certifiedBy: adm.id,
            certifiedAt: daysAgo(14 - index, 10).toISOString(),
          },
        },
        select: { id: true },
      });
    } else {
      await prisma.admLearnerProfile.update({
        where: { id: admProfile.id },
        data: {
          termId: term.id,
          stage: "enrollment_monitoring",
          eligibilityStatus: "eligible",
          preparedBy: adm.id,
          approvedBy: principal.id,
          approvedAt: daysAgo(12 - index, 11),
          returnedAt: null,
          returnReason: null,
        },
      });
    }

    // ---- 4. Evidence forms (only the missing ones) ----
    const forms = await prisma.admForm.findMany({
      where: { admLearnerProfileId: admProfile.id },
      select: { formType: true },
    });
    const haveForms = new Set(forms.map((f) => f.formType));
    for (const formType of ["REFERRAL_FORM", "ANECDOTAL_REPORT", "CERTIFICATION"] as const) {
      if (haveForms.has(formType)) continue;
      await prisma.admForm.create({
        data: {
          admLearnerProfileId: admProfile.id,
          formType,
          title: FORM_TITLES[formType],
          status: "verified",
          uploadedBy: adm.id,
          uploadedAt: daysAgo(14 - index, 10),
          notes: "Seeded ADM evidence.",
        },
      });
    }

    // ---- 5. Modules (mixed submission keeps the monitoring board lively) ----
    const existingModules = await prisma.admModule.count({
      where: { admLearnerProfileId: admProfile.id },
    });
    if (existingModules === 0) {
      for (const [mIndex, moduleName] of MODULES.entries()) {
        const submitted = (mIndex + index) % 3 !== 2;
        await prisma.admModule.create({
          data: {
            admLearnerProfileId: admProfile.id,
            moduleName,
            releaseDate: daysAgo(10 - mIndex, 9),
            dueDate: daysAgo(3 - mIndex, 17),
            submitted,
            submissionDate: submitted ? daysAgo(4 - mIndex, 15) : null,
            submissionUrl: submitted
              ? `https://drive.google.com/drive/folders/zentra-${roster.lrn}-module-${mIndex + 1}`
              : null,
            remarks: submitted ? "Received and checked." : "Awaiting learner submission.",
            recordedBy: teacher.id,
          },
        });
      }
    }

    report.push(
      [
        `LRN ${roster.lrn}`,
        roster.fullName,
        `${roster.lrn}@${LEARNER_EMAIL_DOMAIN}`,
        `case ${admProfile.id}`,
      ].join(" | "),
    );
  }

  console.log("");
  console.log(`${SECTION_NAME} · teacher ${teacher.fullName} (${TEACHER_EMAIL})`);
  console.log(`Term ${term.termNumber} · classes: ${assignments.map((a) => a.subject.code).join(", ")}`);
  console.log(`ADM cases signed by ${principal.fullName}, prepared by ${adm.fullName}`);
  console.log("");
  for (const line of report) console.log(line);
  console.log("");
  console.log(`Password for every seeded learner: ${LEARNER_PASSWORD}`);
  console.log(`Seeded ${report.length} ADM-enrolled learners in ${SECTION_NAME}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
