import "dotenv/config";
import argon2 from "argon2";
import crypto from "crypto";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";
import { mascotForUnique, sectionTakenMascots } from "../src/services/mascot.js";

/**
 * Seeds exactly three Reogie (G7) advisees with opened ADM cases so the
 * teacher advisory desk (/teacher/advisory/adm-cases) has module-tracking data
 * for the logged-in adviser (Test Tester).
 *
 * Each case ends up with:
 *   - a registered StudentProfile (roster-only learners are provisioned),
 *   - an endorsed ADM referral filed by the section adviser,
 *   - an AdmLearnerProfile at `enrollment_monitoring` (principal-approved),
 *   - verified evidence forms and a few AdmModule rows with mixed submission.
 *
 * Idempotent: learners that already carry an ADM profile keep it — the script
 * only tops up missing forms/modules and re-points the profile at the current
 * term. Run with "--reset" to delete the three cases and their referrals first.
 */

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

const SECTION_NAME = "Reogie";

interface Target {
  lrn: string;
  /** Modules seeded for the case (mixed submission keeps the tracking UI lively). */
  modules: { name: string; submitted: boolean }[];
  reason: string;
  incident: string;
}

const TARGETS: Target[] = [
  {
    lrn: "729695905501",
    reason:
      "ADM consultation — irregular attendance (9 absences this term); needs modular learning review and module tracking.",
    incident:
      "Student has been absent 9 times this term without excuse letters; guardian could not be reached by phone.",
    modules: [
      { name: "Module 1 · Reading Comprehension", submitted: true },
      { name: "Module 2 · Fractions & Decimals", submitted: true },
      { name: "Module 3 · Scientific Method", submitted: true },
      { name: "Module 4 · Araling Panlipunan", submitted: false },
    ],
  },
  {
    lrn: "119367332042",
    reason:
      "ADM consultation — working student, needs flexible modular delivery with weekly module tracking.",
    incident:
      "Student reports working evenings to support the family and has missed three consecutive weeks of outputs.",
    modules: [
      { name: "Module 1 · Short Stories", submitted: true },
      { name: "Module 2 · Integers", submitted: false },
      { name: "Module 3 · Community & Environment", submitted: false },
    ],
  },
  {
    lrn: "212868409756",
    reason:
      "ADM consultation — prolonged illness; doctor advised home-based modular learning with module monitoring.",
    incident:
      "Medical certificate on file for a four-week recovery period; classroom attendance is not advised yet.",
    modules: [
      { name: "Module 1 · Grammar Essentials", submitted: true },
      { name: "Module 2 · Ratio & Proportion", submitted: true },
      { name: "Module 3 · Matter & Its Properties", submitted: false },
      { name: "Module 4 · Study Skills", submitted: false },
    ],
  },
];

function daysAgo(n: number, hour = 9): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** Placeholder Drive folder URL so the seeded monitoring page has links to open. */
const driveLink = (lrn: string, moduleIndex: number) =>
  `https://drive.google.com/drive/folders/zentra-${lrn}-module-${moduleIndex + 1}`;

const FORM_TITLES: Record<string, string> = {
  REFERRAL_FORM: "GCForm-03 · ADM Referral Form",
  ANECDOTAL_REPORT: "Anecdotal Report",
  CERTIFICATION: "Recommendation & Certification",
};

async function main() {
  const section = await prisma.section.findFirst({
    where: { name: SECTION_NAME },
    select: { id: true, name: true, gradeLevel: true, schoolYearId: true, adviserId: true },
  });
  if (!section) throw new Error(`Section "${SECTION_NAME}" not found.`);
  if (!section.adviserId) throw new Error(`Section "${SECTION_NAME}" has no adviser.`);
  const adviserId = section.adviserId;

  const schoolYear = await prisma.schoolYear.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  if (!schoolYear) throw new Error("No active school year — run the base seed first.");

  // Follow the same term the teacher desk resolves: the term covering today.
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
    const u = await prisma.user.findUnique({
      where: { email },
      select: { id: true, fullName: true },
    });
    if (!u) throw new Error(`Missing staff account ${email} — run the base seed first.`);
    return u;
  };
  const adm = await byEmail("adm@zentra.test");
  const guidance = await byEmail("guidance@zentra.test");
  const principal = await byEmail("principal@zentra.test");

  const rosters = await prisma.studentRoster.findMany({
    where: { sectionId: section.id, lrn: { in: TARGETS.map((t) => t.lrn) } },
    select: { id: true, lrn: true, fullName: true, gradeLevel: true },
  });
  if (rosters.length !== TARGETS.length) {
    throw new Error(
      `Expected ${TARGETS.length} ${SECTION_NAME} roster entries, found ${rosters.length} (${rosters
        .map((r) => r.fullName)
        .join(", ")}).`,
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
      await prisma.admLearnerProfile.deleteMany({
        where: { id: { in: existing.map((p) => p.id) } },
      });
      await prisma.referral.deleteMany({ where: { id: { in: referralIds } } });
      await prisma.anecdotalRecord.deleteMany({ where: { id: { in: anecdotalIds } } });
      console.log(`Reset: removed ${existing.length} ${SECTION_NAME} ADM case(s).`);
    }
  }

  const report: string[] = [];
  // Mascots must be unique within the section board — seed them the same way
  // the API does, from the roster name/LRN canonical hash.
  const takenMascots = await sectionTakenMascots(prisma, section.id);

  for (const [index, target] of TARGETS.entries()) {
    const roster = rosters.find((r) => r.lrn === target.lrn);
    if (!roster) throw new Error(`Roster entry for LRN ${target.lrn} missing.`);

    // ---- 1. Registered learner (provision from the roster when needed) ----
    let profile = await prisma.studentProfile.findUnique({
      where: { lrn: roster.lrn },
      select: { userId: true },
    });
    if (!profile) {
      const email = `${roster.lrn}@adm-provisioned.local`;
      const passwordHash = await argon2.hash(crypto.randomBytes(32).toString("hex"));
      const created = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          passwordHash,
          role: "student",
          fullName: roster.fullName,
          lrn: roster.lrn,
          status: "active",
        },
      });
      await prisma.studentProfile.create({
        data: {
          userId: created.id,
          lrn: roster.lrn,
          gradeLevel: roster.gradeLevel,
          sectionId: section.id,
        },
      });
      profile = { userId: created.id };
    } else {
      await prisma.studentProfile.update({
        where: { userId: profile.userId },
        data: { sectionId: section.id },
      });
      // The desk shows the learner's account name, so keep it aligned with the
      // section roster the adviser sees in the advisory list — never a name
      // carried over from another (SF10) source.
      await prisma.user.update({
        where: { id: profile.userId },
        data: { fullName: roster.fullName },
      });
    }
    const studentId = profile.userId;

    // ---- 1b. Mascot (unique within the section board) ----
    const mascot = mascotForUnique(roster.fullName, roster.lrn, takenMascots);
    takenMascots.add(mascot);
    await prisma.studentProfile.update({
      where: { userId: studentId },
      data: { mascot },
    });
    await prisma.studentRoster.update({
      where: { id: roster.id },
      data: { mascot },
    });

    // ---- 2. Endorsed ADM referral filed by the section adviser ----
    let referral = await prisma.referral.findFirst({
      where: {
        studentId,
        referredToRole: "adm_coordinator",
        status: { not: "dismissed" },
      },
      select: { id: true },
    });
    if (!referral) {
      // Reuse an anecdotal record the adviser already filed for this learner;
      // otherwise file one so the referral has its evidence trail.
      let anecdotal = await prisma.anecdotalRecord.findFirst({
        where: { studentId, observerId: adviserId },
        select: { id: true },
        orderBy: { observationDatetime: "desc" },
      });
      if (!anecdotal) {
        anecdotal = await prisma.anecdotalRecord.create({
          data: {
            studentId,
            rosterId: null,
            observerId: adviserId,
            sectionId: section.id,
            observationDatetime: daysAgo(20 + index, 8),
            descriptionOfIncident: target.incident,
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
      }
      referral = await prisma.referral.create({
        data: {
          anecdotalRecordId: anecdotal.id,
          referredToRole: "adm_coordinator",
          referredBy: adviserId,
          reason: target.reason,
          consultReviewer: "guidance_counselor",
          consultReviewedAt: daysAgo(16 + index, 10),
          referralFormReady: true,
          status: "in_progress",
          studentId,
          rosterId: null,
          termId: term.id,
        },
        select: { id: true },
      });
    } else {
      // Already endorsed — just make sure the intake fields are complete.
      await prisma.referral.update({
        where: { id: referral.id },
        data: {
          status: "in_progress",
          consultReviewer: "guidance_counselor",
          consultReviewedAt: daysAgo(16 + index, 10),
          referralFormReady: true,
        },
      });
    }

    // ---- 3. ADM learner profile in module tracking ----
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
          approvedAt: daysAgo(12 + index, 11),
          certificationDetails: {
            recommendation: "Home-based modular learning with weekly module tracking.",
            certifiedBy: adm.id,
            certifiedAt: daysAgo(14 + index, 10).toISOString(),
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
          approvedAt: daysAgo(12 + index, 11),
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
          uploadedAt: daysAgo(14 + index, 10),
          notes: "Seeded ADM evidence.",
        },
      });
    }

    // ---- 5. Modules for tracking ----
    const moduleCount = await prisma.admModule.count({
      where: { admLearnerProfileId: admProfile.id },
    });
    if (moduleCount === 0) {
      for (const [mIndex, m] of target.modules.entries()) {
        await prisma.admModule.create({
          data: {
            admLearnerProfileId: admProfile.id,
            moduleName: m.name,
            releaseDate: daysAgo(10 - mIndex * 3, 8),
            dueDate: daysAgo(3 - mIndex * 3, 8),
            submitted: m.submitted,
            submissionDate: m.submitted ? daysAgo(4 - mIndex * 3, 8) : null,
            submissionUrl: m.submitted ? driveLink(roster.lrn, mIndex) : null,
            recordedBy: adm.id,
          },
        });
      }
    }
    // Top up upload links on already-seeded submissions so the monitoring page
    // has something to open (idempotent for every later run).
    const missingLinks = await prisma.admModule.findMany({
      where: {
        admLearnerProfileId: admProfile.id,
        submitted: true,
        submissionUrl: null,
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    for (const [linkIndex, row] of missingLinks.entries()) {
      await prisma.admModule.update({
        where: { id: row.id },
        data: { submissionUrl: driveLink(roster.lrn, linkIndex) },
      });
    }

    const submitted = target.modules.filter((m) => m.submitted).length;
    report.push(
      `${roster.fullName} (LRN ${roster.lrn}) — profile ${admProfile.id} · ${submitted}/${target.modules.length} modules submitted`,
    );
  }

  console.log(`Seeded ${TARGETS.length} ${SECTION_NAME} ADM case(s) · adviser ${adviserId} · term ${term.termNumber}:`);
  for (const line of report) console.log(`  - ${line}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
