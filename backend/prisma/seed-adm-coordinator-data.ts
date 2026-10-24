import "dotenv/config";
import argon2 from "argon2";
import crypto from "crypto";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

/**
 * Seeds the ADM Coordinator desk with a full, realistic pipeline so every
 * coordinator page has data:
 *   - Overview      (/api/adm/dashboard)
 *   - Referrals     (/api/adm/referrals/all) + case detail/history
 *   - Certifications(/api/adm/referrals/all + /api/adm/approvals)
 *   - Devices       (/api/adm/devices)
 *   - Enrolled      (stage=enrollment_monitoring / completion)
 *
 * The coordinator intake only surfaces cases whose referral was endorsed by a
 * nurse / guidance counselor with the referral form completed
 * (referralFormReady = true). The existing guidance/nurse ADM seeds do NOT set
 * that flag and create no AdmLearnerProfile, so they never reach the coordinator
 * board — this script fills that gap.
 *
 * Idempotent: learners already carrying an ADM profile (or an endorsed ADM
 * referral) are skipped. Non-destructive otherwise.
 */

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

type AdmStage =
  | "meeting_parents"
  | "home_visitation"
  | "certification"
  | "principal_approval"
  | "enrollment_monitoring"
  | "completion";

type AdmFormKind =
  | "REFERRAL_FORM"
  | "ANECDOTAL_REPORT"
  | "CERTIFICATION"
  | "MINUTES_OF_MEETING"
  | "HV_FORM";

interface CaseSpec {
  stage: AdmStage;
  eligibility: "pending" | "eligible" | "ineligible";
  approved: boolean;
  category: "behavioral" | "bullying" | "academic" | "attendance" | "health";
  incident: string;
  location: string;
  notes: string;
  classPerformance: string;
  attendanceSummary: string;
  reason: string;
  recommendation?: string;
  reviewer: "nurse" | "guidance_counselor";
  observationDaysAgo: number;
  meeting?: {
    venue: "school" | "home";
    attended: boolean;
    daysAgo: number;
    minutes?: string;
    logbook?: string;
  };
  forms: AdmFormKind[];
  modules?: { name: string; submitted: boolean }[];
  device?: { type: string; serial: string; returned: boolean };
}

const CASES: CaseSpec[] = [
  // ---- Meeting with parents (in-progress intake) ----
  {
    stage: "meeting_parents",
    eligibility: "pending",
    approved: false,
    category: "attendance",
    incident:
      "Student has 12 unexcused absences this term; three phone attempts to the guardian went unanswered.",
    location: "Classroom / home",
    notes: "Book a parent conference to verify the home situation before deciding on modular setup.",
    classPerformance: "Failing two subjects from missed lessons.",
    attendanceSummary: "12 absences, 5 tardy marks.",
    reason: "Chronic absenteeism flagged to ADM — needs parent conference.",
    reviewer: "guidance_counselor",
    observationDaysAgo: 9,
    meeting: {
      venue: "school",
      attended: false,
      daysAgo: 6,
    },
    forms: ["REFERRAL_FORM", "ANECDOTAL_REPORT"],
  },
  {
    stage: "meeting_parents",
    eligibility: "pending",
    approved: false,
    category: "behavioral",
    incident:
      "Student disrupted three lessons this week and walked out once after a disagreement with a seatmate.",
    location: "Classroom",
    notes: "Meet the guardian to agree on a behavior contract and a check-in schedule.",
    classPerformance: "Capable when focused one-on-one; outputs incomplete.",
    attendanceSummary: "Present daily.",
    reason: "Repeated classroom disruptions — needs ADM parent conference.",
    reviewer: "nurse",
    observationDaysAgo: 7,
    meeting: {
      venue: "school",
      attended: false,
      daysAgo: 4,
    },
    forms: ["REFERRAL_FORM", "ANECDOTAL_REPORT"],
  },

  // ---- Home visitation (parents missed the conference) ----
  {
    stage: "home_visitation",
    eligibility: "pending",
    approved: false,
    category: "attendance",
    incident:
      "Learner has missed mornings for two weeks to help at the family stall; guardian did not attend the scheduled conference.",
    location: "Barangay San Roque",
    notes: "Conduct a home visit to document the situation and explore a flexible schedule.",
    classPerformance: "Morning work strong; afternoon outputs missing.",
    attendanceSummary: "Half-day pattern for two straight weeks.",
    reason: "Guardian no-showed the conference — proceed to home visitation.",
    reviewer: "guidance_counselor",
    observationDaysAgo: 14,
    meeting: {
      venue: "school",
      attended: false,
      daysAgo: 10,
    },
    forms: ["REFERRAL_FORM", "ANECDOTAL_REPORT"],
  },
  {
    stage: "home_visitation",
    eligibility: "pending",
    approved: false,
    category: "health",
    incident:
      "Student reported recurring dizziness in class; guardian could not be reached for the clinic follow-up meeting.",
    location: "School clinic / residence",
    notes: "Home visit to assess the home environment and secure a guardian consent for follow-up.",
    classPerformance: "Previously participative; withdrawn this week.",
    attendanceSummary: "2 health-related absences.",
    reason: "Guardian unreachable for health conference — home visitation required.",
    reviewer: "nurse",
    observationDaysAgo: 12,
    meeting: {
      venue: "school",
      attended: false,
      daysAgo: 8,
    },
    forms: ["REFERRAL_FORM", "ANECDOTAL_REPORT"],
  },

  // ---- Certification (evidence gathered, recommendation pending) ----
  {
    stage: "certification",
    eligibility: "eligible",
    approved: false,
    category: "academic",
    incident:
      "Learner stopped submitting modules across all subjects after the second month; family requests modular placement.",
    location: "Classroom",
    notes: "Evidence complete: referral form, anecdotal report, attended conference. Recommend ADM modular placement.",
    classPerformance: "No outputs this term despite remediation invites.",
    attendanceSummary: "Present daily but unproductive.",
    reason: "Zero-output term, family requests modular setup — ADM evaluation.",
    recommendation: "Recommend ADM modular placement with weekly monitoring.",
    reviewer: "guidance_counselor",
    observationDaysAgo: 20,
    meeting: {
      venue: "school",
      attended: true,
      daysAgo: 15,
      minutes:
        "Guardian present. Agreed to a modular setup with weekly module release and a coordinator check-in.",
      logbook: "LOG-2026-0148",
    },
    forms: ["REFERRAL_FORM", "ANECDOTAL_REPORT", "MINUTES_OF_MEETING", "CERTIFICATION"],
    modules: [
      { name: "Module 1 — Math", submitted: false },
      { name: "Module 1 — Science", submitted: false },
    ],
  },
  {
    stage: "certification",
    eligibility: "eligible",
    approved: false,
    category: "bullying",
    incident:
      "Learner was cornered behind the canteen and threatened twice; too frightened to report until the adviser noticed.",
    location: "Behind the canteen",
    notes: "Conference held with both families. Recommend ADM oversight with coordinated monitoring.",
    classPerformance: "Withdrawing; grades slipping since the incidents.",
    attendanceSummary: "Present daily; avoids recess areas.",
    reason: "Extortion-style bullying — ADM follow-through with both families.",
    recommendation: "Recommend continued monitoring and psychosocial follow-up.",
    reviewer: "guidance_counselor",
    observationDaysAgo: 18,
    meeting: {
      venue: "school",
      attended: true,
      daysAgo: 13,
      minutes:
        "Both families present. Agreed on no-contact arrangement and weekly coordinator check-ins.",
      logbook: "LOG-2026-0151",
    },
    forms: ["REFERRAL_FORM", "ANECDOTAL_REPORT", "MINUTES_OF_MEETING", "CERTIFICATION"],
  },
  {
    stage: "certification",
    eligibility: "eligible",
    approved: false,
    category: "health",
    incident:
      "Learner fainted during flag ceremony; history of skipping breakfast and a long commute reported.",
    location: "Flag ceremony grounds",
    notes: "Evidence complete after home visitation. Recommend a health plan and modular days.",
    classPerformance: "Good standing; one missed activity.",
    attendanceSummary: "Present daily; 1 late.",
    reason: "Fainting episode — health plan and possible modular days.",
    recommendation: "Recommend ADM with a health plan and reduced-load days.",
    reviewer: "nurse",
    observationDaysAgo: 16,
    meeting: {
      venue: "home",
      attended: true,
      daysAgo: 11,
      minutes:
        "Home visit conducted. Guardian agreed to a health plan; learner to submit remaining modules.",
      logbook: "LOG-2026-0155",
    },
    forms: [
      "REFERRAL_FORM",
      "ANECDOTAL_REPORT",
      "HV_FORM",
      "MINUTES_OF_MEETING",
      "CERTIFICATION",
    ],
    modules: [{ name: "Module 2 — English", submitted: false }],
  },

  // ---- Principal approval (awaiting signature) ----
  {
    stage: "principal_approval",
    eligibility: "eligible",
    approved: false,
    category: "behavioral",
    incident:
      "Learner brought a cutter and threatened a seatmate during a quarrel; object confiscated, no one hurt.",
    location: "Classroom",
    notes: "Certified with a behavior contract. Endorsed to the School Head for signature.",
    classPerformance: "Suspended from group activities pending review.",
    attendanceSummary: "Present daily this quarter.",
    reason: "Weapon-related threat — ADM behavior contract for final approval.",
    recommendation: "Recommend ADM with a signed behavior contract and weekly counseling.",
    reviewer: "guidance_counselor",
    observationDaysAgo: 22,
    meeting: {
      venue: "school",
      attended: true,
      daysAgo: 17,
      minutes:
        "Guardian present. Behavior contract drafted; learner to complete counseling sessions.",
      logbook: "LOG-2026-0162",
    },
    forms: ["REFERRAL_FORM", "ANECDOTAL_REPORT", "MINUTES_OF_MEETING", "CERTIFICATION"],
    modules: [{ name: "Module 3 — TLE", submitted: false }],
  },
  {
    stage: "principal_approval",
    eligibility: "eligible",
    approved: false,
    category: "attendance",
    incident:
      "Truancy with forged excuse letters discovered; learner missed 18 days this quarter.",
    location: "Classroom / home",
    notes: "Certified after home visitation. Endorsed to the School Head for signature.",
    classPerformance: "Failing four subjects from missed lessons.",
    attendanceSummary: "18 absences, forged excuses confirmed.",
    reason: "Truancy with forged documents — ADM home-monitoring plan.",
    recommendation: "Recommend ADM home monitoring with attendance verification.",
    reviewer: "nurse",
    observationDaysAgo: 24,
    meeting: {
      venue: "home",
      attended: true,
      daysAgo: 18,
      minutes:
        "Home visit confirmed the learner helps at the family store. Guardian agreed to a daily attendance log.",
      logbook: "LOG-2026-0166",
    },
    forms: [
      "REFERRAL_FORM",
      "ANECDOTAL_REPORT",
      "HV_FORM",
      "MINUTES_OF_MEETING",
      "CERTIFICATION",
    ],
  },
  {
    stage: "principal_approval",
    eligibility: "ineligible",
    approved: false,
    category: "academic",
    incident:
      "Learner is failing three subjects; family requested modular placement but the certification form is still incomplete.",
    location: "Classroom",
    notes: "Returned by the School Head for revision — certification form missing; parent conference outcome not yet logged.",
    classPerformance: "Failing Math, Science, and English.",
    attendanceSummary: "Present but unproductive; 2 absences.",
    reason: "Academic decline — returned to ADM for incomplete certification documents.",
    reviewer: "guidance_counselor",
    observationDaysAgo: 25,
    meeting: {
      venue: "school",
      attended: true,
      daysAgo: 19,
      minutes: "Guardian present. Agreed to revisit the modular request after grades are recovered.",
      logbook: "LOG-2026-0170",
    },
    // Missing CERTIFICATION on purpose → needs revision on the certifications page.
    forms: ["REFERRAL_FORM", "ANECDOTAL_REPORT", "MINUTES_OF_MEETING"],
  },

  // ---- Enrollment monitoring (principal-approved, device out) ----
  {
    stage: "enrollment_monitoring",
    eligibility: "eligible",
    approved: true,
    category: "behavioral",
    incident:
      "Group vaping on campus; devices confiscated and all learners admitted repeated use.",
    location: "Restroom",
    notes: "Approved by the School Head. Modular monitoring with a loaned tablet underway.",
    classPerformance: "Slipping; frequent restroom breaks noted earlier.",
    attendanceSummary: "Present daily.",
    reason: "Group misconduct — ADM monitoring with module tracking.",
    recommendation: "Recommend ADM monitoring with weekly module submission checks.",
    reviewer: "nurse",
    observationDaysAgo: 30,
    meeting: {
      venue: "school",
      attended: true,
      daysAgo: 24,
      minutes:
        "Guardian present. Agreed to weekly module submissions and device-use guidelines.",
      logbook: "LOG-2026-0175",
    },
    forms: ["REFERRAL_FORM", "ANECDOTAL_REPORT", "MINUTES_OF_MEETING", "CERTIFICATION"],
    modules: [
      { name: "Module 1 — Math", submitted: true },
      { name: "Module 2 — Math", submitted: true },
      { name: "Module 3 — Math", submitted: false },
    ],
    device: { type: "Tablet", serial: "ADM-TAB-2001", returned: false },
  },
  {
    stage: "enrollment_monitoring",
    eligibility: "eligible",
    approved: true,
    category: "academic",
    incident:
      "Learner works night shifts at the market and sleeps through morning classes; family requested a flexible setup.",
    location: "Classroom",
    notes: "Approved by the School Head. Modular schedule with a loaned tablet in place.",
    classPerformance: "Previously average; now failing quizzes from missed lessons.",
    attendanceSummary: "Present but asleep; 5 tardy marks.",
    reason: "Night-shift work — ADM flexible schedule monitoring.",
    recommendation: "Recommend ADM with an evening-friendly module schedule.",
    reviewer: "guidance_counselor",
    observationDaysAgo: 28,
    meeting: {
      venue: "school",
      attended: true,
      daysAgo: 22,
      minutes:
        "Guardian present. Agreed on a flexible schedule and monthly progress review.",
      logbook: "LOG-2026-0178",
    },
    forms: ["REFERRAL_FORM", "ANECDOTAL_REPORT", "MINUTES_OF_MEETING", "CERTIFICATION"],
    modules: [
      { name: "Module 1 — Science", submitted: true },
      { name: "Module 2 — Science", submitted: false },
    ],
    device: { type: "Tablet", serial: "ADM-TAB-2002", returned: false },
  },

  // ---- Completion (device returned) ----
  {
    stage: "completion",
    eligibility: "eligible",
    approved: true,
    category: "attendance",
    incident:
      "Long commute forced repeated half-days; a modular setup with a loaned tablet stabilized attendance.",
    location: "School gate",
    notes: "All modules submitted, attendance recovered, device returned. Case closed.",
    classPerformance: "Recovered to passing in all subjects.",
    attendanceSummary: "Attendance recovered to 96% this term.",
    reason: "Commute-driven absences — ADM case completed.",
    recommendation: "Recommend case completion; device returned in good condition.",
    reviewer: "guidance_counselor",
    observationDaysAgo: 45,
    meeting: {
      venue: "school",
      attended: true,
      daysAgo: 40,
      minutes: "Guardian present. Modular setup agreed and later completed successfully.",
      logbook: "LOG-2026-0120",
    },
    forms: ["REFERRAL_FORM", "ANECDOTAL_REPORT", "MINUTES_OF_MEETING", "CERTIFICATION"],
    modules: [
      { name: "Module 1 — Math", submitted: true },
      { name: "Module 2 — Math", submitted: true },
      { name: "Module 3 — Math", submitted: true },
    ],
    device: { type: "Tablet", serial: "ADM-TAB-2003", returned: true },
  },
];

// Referrals endorsed to ADM but not yet turned into a profile — they surface in
// the coordinator's "Consultation & referral" bucket as early cases.
interface EarlySpec {
  category: "behavioral" | "bullying" | "academic" | "attendance" | "health";
  incident: string;
  location: string;
  notes: string;
  classPerformance: string;
  attendanceSummary: string;
  reason: string;
  reviewer: "nurse" | "guidance_counselor";
  observationDaysAgo: number;
}

const EARLY: EarlySpec[] = [
  {
    category: "academic",
    incident:
      "Learner's grades dropped from passing to failing in three subjects within one quarter.",
    location: "Classroom",
    notes: "Endorsed to ADM for evaluation of a home-based module setup.",
    classPerformance: "Failing Math, Science, and English this quarter.",
    attendanceSummary: "Present but unproductive; 2 absences.",
    reason: "Sharp academic decline — endorsed to ADM for evaluation.",
    reviewer: "guidance_counselor",
    observationDaysAgo: 3,
  },
  {
    category: "attendance",
    incident:
      "Learner travels over an hour each way and has started leaving at lunch, effectively missing afternoons.",
    location: "School gate",
    notes: "Endorsed to ADM — distance setup may qualify for modular-afternoon consideration.",
    classPerformance: "Morning work satisfactory; afternoon outputs missing.",
    attendanceSummary: "Half-day pattern for two straight weeks.",
    reason: "Long commute forces half-days — endorsed to ADM.",
    reviewer: "guidance_counselor",
    observationDaysAgo: 5,
  },
  {
    category: "health",
    incident:
      "Learner reported persistent cough and sore throat for three days; temperature slightly elevated at clinic check.",
    location: "Classroom",
    notes: "Endorsed to ADM for a possible temporary modular setup while recovering.",
    classPerformance: "Grades stable; concentration affected during coughing fits.",
    attendanceSummary: "1 absence last week; otherwise present.",
    reason: "Persistent cough/fever — endorsed to ADM for a temporary modular setup.",
    reviewer: "nurse",
    observationDaysAgo: 2,
  },
];

function daysAgo(n: number, hour = 9): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function main() {
  const schoolYear = await prisma.schoolYear.findFirst({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  if (!schoolYear) throw new Error("No active school year — run the base seed first.");

  const term =
    (await prisma.term.findFirst({
      where: { schoolYearId: schoolYear.id, termNumber: 1 },
      select: { id: true, termNumber: true },
    })) ??
    (await prisma.term.findFirst({
      where: { schoolYearId: schoolYear.id },
      select: { id: true, termNumber: true },
      orderBy: { termNumber: "asc" },
    }));
  if (!term) throw new Error(`No term found for school year ${schoolYear.name}.`);

  // Idempotency: don't pile up a new cohort on every run. `--reset` wipes the
  // ADM profiles this seed produces (plus their referrals) before re-seeding.
  const reset = process.argv.includes("--reset");
  const existingProfiles = await prisma.admLearnerProfile.findMany({
    select: { id: true, referralId: true },
  });
  if (!reset && existingProfiles.length > 0) {
    console.log(
      `ADM profiles already exist (${existingProfiles.length}). Skipping — re-run with "--reset" to wipe and re-seed.`,
    );
    return;
  }
  if (reset && existingProfiles.length > 0) {
    const referralIds = existingProfiles.map((p) => p.referralId);
    const anecdotalIds = (
      await prisma.referral.findMany({
        where: { id: { in: referralIds } },
        select: { anecdotalRecordId: true },
      })
    ).map((r) => r.anecdotalRecordId);
    await prisma.admLearnerProfile.deleteMany({}); // cascades forms/meetings/modules/devices/invites
    await prisma.referral.deleteMany({ where: { id: { in: referralIds } } });
    await prisma.anecdotalRecord.deleteMany({ where: { id: { in: anecdotalIds } } });
    console.log(`Reset: removed ${existingProfiles.length} ADM profile(s) and their referrals.`);
  }

  const byEmail = async (email: string) => {
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true, fullName: true } });
    if (!u) throw new Error(`Missing staff account ${email} — run the base seed first.`);
    return u;
  };
  const principal = await byEmail("principal@zentra.test");
  const adm = await byEmail("adm@zentra.test");
  const guidance = await byEmail("guidance@zentra.test");
  const nurse = await byEmail("nurse@zentra.test");

  const reviewerUser = (r: "nurse" | "guidance_counselor") =>
    r === "nurse" ? nurse : guidance;

  // Registered learners with a section are used first; when the school has too
  // few registered accounts the seed provisions them from the roster, mirroring
  // the real ADM intake (profiles.intake.service.ts). Section advisers are
  // frequently unassigned in seeded data, so a rotating adviser account is used
  // as the observer/anecdotal author when the section has none.
  const adviserPool = (
    await prisma.user.findMany({ where: { role: "adviser" }, select: { id: true }, orderBy: { fullName: "asc" } })
  ).map((u) => u.id);
  if (adviserPool.length === 0) adviserPool.push(adm.id);
  let adviserCursor = 0;
  const pickObserver = (adviserId: string | null) =>
    adviserId ?? adviserPool[adviserCursor++ % adviserPool.length];

  const alreadyEndorsed = new Set(
    (
      await prisma.referral.findMany({
        where: { referredToRole: "adm_coordinator", referralFormReady: true },
        select: { studentId: true },
      })
    )
      .map((r) => r.studentId)
      .filter((v): v is string => Boolean(v)),
  );

  interface Learner {
    studentId: string;
    lrn: string;
    fullName: string;
    sectionId: string;
    sectionName: string;
    adviserId: string | null;
  }

  const needed = CASES.length + EARLY.length;
  const learners: Learner[] = [];
  const seenLrn = new Set<string>();

  const registered = await prisma.studentProfile.findMany({
    where: { sectionId: { not: null } },
    include: {
      user: { select: { fullName: true } },
      section: { select: { id: true, name: true, adviserId: true } },
      admProfiles: { select: { id: true } },
    },
    orderBy: { lrn: "asc" },
  });
  for (const s of registered) {
    if (s.admProfiles.length > 0) continue;
    if (alreadyEndorsed.has(s.userId)) continue;
    learners.push({
      studentId: s.userId,
      lrn: s.lrn,
      fullName: s.user.fullName,
      sectionId: s.sectionId!,
      sectionName: s.section?.name ?? "",
      adviserId: s.section?.adviserId ?? null,
    });
    seenLrn.add(s.lrn);
  }

  if (learners.length < needed) {
    const roster = await prisma.studentRoster.findMany({
      where: { schoolYearId: schoolYear.id },
      include: { section: { select: { id: true, name: true, adviserId: true } } },
      orderBy: { lrn: "asc" },
    });
    for (const r of roster) {
      if (learners.length >= needed) break;
      if (seenLrn.has(r.lrn)) continue;

      let studentId: string | null = null;
      const existing = await prisma.studentProfile.findUnique({
        where: { lrn: r.lrn },
        select: { userId: true },
      });
      if (existing) {
        if (alreadyEndorsed.has(existing.userId)) continue;
        const hasAdm = await prisma.admLearnerProfile.findFirst({
          where: { studentId: existing.userId },
          select: { id: true },
        });
        if (hasAdm) continue;
        studentId = existing.userId;
      } else {
        const email = `${r.lrn}@adm-provisioned.local`;
        const passwordHash = await argon2.hash(crypto.randomBytes(32).toString("hex"));
        const created = await prisma.user.upsert({
          where: { email },
          update: {},
          create: {
            email,
            passwordHash,
            role: "student",
            fullName: r.fullName,
            lrn: r.lrn,
            status: "active",
          },
        });
        await prisma.studentProfile.create({
          data: { userId: created.id, lrn: r.lrn, gradeLevel: r.gradeLevel, sectionId: r.sectionId },
        });
        studentId = created.id;
      }

      learners.push({
        studentId,
        lrn: r.lrn,
        fullName: r.fullName,
        sectionId: r.sectionId,
        sectionName: r.section.name,
        adviserId: r.section.adviserId,
      });
      seenLrn.add(r.lrn);
    }
  }

  if (learners.length === 0) {
    console.log("Nothing to seed — every eligible learner already has an ADM case (already seeded?).");
    return;
  }
  const casesToRun = CASES.slice(0, Math.min(CASES.length, learners.length));
  const earlyToRun = EARLY.slice(
    0,
    Math.max(0, learners.length - casesToRun.length),
  );
  if (casesToRun.length < CASES.length) {
    console.warn(
      `Only ${learners.length} eligible learner(s) available; seeding ${casesToRun.length} case(s) and ${earlyToRun.length} consultation(s).`,
    );
  }

  let cursor = 0;
  const nextStudent = () => learners[cursor++];
  let createdProfiles = 0;
  let createdEarly = 0;

  for (const spec of casesToRun) {
    const student = nextStudent();
    const adviserId = pickObserver(student.adviserId);
    const observedAt = daysAgo(spec.observationDaysAgo, 8);
    const endorsedAt = daysAgo(Math.max(0, spec.observationDaysAgo - 1), 10);

    const anecdotal = await prisma.anecdotalRecord.create({
      data: {
        studentId: student.studentId,
        rosterId: null,
        observerId: adviserId,
        sectionId: student.sectionId,
        observationDatetime: observedAt,
        descriptionOfIncident: spec.incident,
        descriptionOfLocation: spec.location,
        notesRecommendationsActions: spec.notes,
        classPerformance: spec.classPerformance,
        attendanceSummary: spec.attendanceSummary,
        category: spec.category,
        confidentialityLevel: "restricted",
        termId: term.id,
      },
    });

    const referral = await prisma.referral.create({
      data: {
        anecdotalRecordId: anecdotal.id,
        referredToRole: "adm_coordinator",
        referredBy: adviserId,
        reason: spec.reason,
        consultReviewer: spec.reviewer,
        consultReviewedAt: endorsedAt,
        referralFormReady: true,
        status: "in_progress",
        studentId: student.studentId,
        rosterId: null,
        termId: term.id,
      },
    });

    const profile = await prisma.admLearnerProfile.create({
      data: {
        studentId: student.studentId,
        referralId: referral.id,
        termId: term.id,
        stage: spec.stage,
        eligibilityStatus: spec.eligibility,
        preparedBy: adm.id,
        certificationDetails: {
          recommendation: spec.recommendation ?? null,
          certifiedBy: spec.recommendation ? adm.id : null,
          certifiedAt: spec.recommendation ? endorsedAt.toISOString() : null,
        },
        ...(spec.approved
          ? { approvedBy: principal.id, approvedAt: daysAgo(Math.max(0, spec.observationDaysAgo - 20), 11) }
          : {}),
      },
    });

    // ---- Evidence forms ----
    for (const formType of spec.forms) {
      await prisma.admForm.create({
        data: {
          admLearnerProfileId: profile.id,
          formType,
          title: FORM_TITLES[formType],
          status: "verified",
          uploadedBy: adm.id,
          notes: "Seeded case evidence.",
        },
      });
    }

    // ---- Parent meeting ----
    if (spec.meeting) {
      const meetingAt = daysAgo(spec.meeting.daysAgo, 14);
      const meeting = await prisma.admParentMeeting.create({
        data: {
          admLearnerProfileId: profile.id,
          referralId: null,
          recordedBy: adm.id,
          meetingDatetime: meetingAt,
          venue: spec.meeting.venue,
          attended: spec.meeting.attended,
          parentConfirmedAt: daysAgo(spec.meeting.daysAgo + 2, 12),
          minutesOfMeeting: spec.meeting.minutes ?? null,
          attendanceLogbookRef: spec.meeting.logbook ?? null,
          attendees: spec.meeting.attended
            ? [
                { name: `Parent of ${student.fullName}`, role: "parent_guardian" },
                { name: adm.fullName, role: "teacher" },
                { name: student.fullName, role: "student" },
                { name: reviewerUser(spec.reviewer).fullName, role: spec.reviewer },
              ]
            : [],
        },
      });
      const inviteeIds = [reviewerUser(spec.reviewer).id, adviserId].filter(
        (v, i, arr) => arr.indexOf(v) === i,
      );
      await prisma.admMeetingInvitee.createMany({
        data: inviteeIds.map((userId) => ({ meetingId: meeting.id, userId })),
        skipDuplicates: true,
      });
      await prisma.auditLog.create({
        data: {
          userId: adm.id,
          actionType: "adm_edit",
          sourceTable: "adm_parent_meetings",
          sourceId: meeting.id,
          reason: spec.meeting.attended
            ? "ADM parent meeting logged as attended"
            : "ADM parent meeting logged as not attended",
        },
      });
    }

    // ---- Modules ----
    for (const m of spec.modules ?? []) {
      await prisma.admModule.create({
        data: {
          admLearnerProfileId: profile.id,
          moduleName: m.name,
          releaseDate: daysAgo(Math.max(0, spec.observationDaysAgo - 10), 8),
          dueDate: daysAgo(Math.max(0, spec.observationDaysAgo - 24), 8),
          submitted: m.submitted,
          submissionDate: m.submitted ? daysAgo(Math.max(0, spec.observationDaysAgo - 26), 8) : null,
          recordedBy: adm.id,
        },
      });
    }

    // ---- Device ----
    if (spec.device) {
      const issuedAt = daysAgo(Math.max(0, spec.observationDaysAgo - 22), 10);
      const device = await prisma.admDevice.create({
        data: {
          admLearnerProfileId: profile.id,
          deviceType: spec.device.type,
          deviceSerial: spec.device.serial,
          issuedBy: adm.id,
          issuedDate: issuedAt,
          returnedDate: spec.device.returned ? daysAgo(Math.max(0, spec.observationDaysAgo - 44), 10) : null,
          conditionNotes: spec.device.returned
            ? "Returned in good condition."
            : "Issued for modular learning; to be returned at completion.",
        },
      });
      await prisma.auditLog.create({
        data: {
          userId: adm.id,
          actionType: "adm_edit",
          sourceTable: "adm_devices",
          sourceId: device.id,
          reason: spec.device.returned ? "ADM device returned" : "ADM device issued",
        },
      });
    }

    // ---- Audit trail (history dialog + "last action") ----
    await prisma.auditLog.createMany({
      data: [
        {
          userId: adviserId,
          actionType: "anecdotal_edit",
          sourceTable: "anecdotal_records",
          sourceId: anecdotal.id,
          reason: "Anecdotal record filed",
          createdAt: observedAt,
        },
        {
          userId: adviserId,
          actionType: "referral_adm_initiated",
          sourceTable: "referrals",
          sourceId: referral.id,
          reason: `Referred to adm_coordinator (consult reviewer: ${spec.reviewer})`,
          createdAt: endorsedAt,
        },
        {
          userId: adm.id,
          actionType: "adm_edit",
          sourceTable: "adm_learner_profiles",
          sourceId: profile.id,
          reason: "ADM learner profile created",
          createdAt: endorsedAt,
        },
        {
          userId: adm.id,
          actionType: "adm_edit",
          sourceTable: "adm_learner_profiles",
          sourceId: profile.id,
          reason: `ADM stage advanced to ${spec.stage}`,
          oldValue: { stage: "meeting_parents" },
          newValue: { stage: spec.stage },
          createdAt: daysAgo(Math.max(0, spec.observationDaysAgo - 2), 10),
        },
        ...(spec.approved
          ? [
              {
                userId: principal.id,
                actionType: "adm_principal_approve" as const,
                sourceTable: "adm_learner_profiles",
                sourceId: profile.id,
                reason: "Principal final signature",
                createdAt: daysAgo(Math.max(0, spec.observationDaysAgo - 20), 11),
              },
            ]
          : []),
      ],
    });

    console.log(
      `OK  ${student.lrn} (${student.fullName} / ${student.sectionName}) → ${spec.stage}` +
        `${spec.approved ? " [approved]" : ""}${spec.device ? ` + device ${spec.device.serial}` : ""}`,
    );
    createdProfiles++;
  }

  // ---- Early consultation referrals (no profile yet) ----
  for (const spec of earlyToRun) {
    const student = nextStudent();
    const adviserId = pickObserver(student.adviserId);
    const observedAt = daysAgo(spec.observationDaysAgo, 8);
    const endorsedAt = daysAgo(Math.max(0, spec.observationDaysAgo - 1), 10);

    const anecdotal = await prisma.anecdotalRecord.create({
      data: {
        studentId: student.studentId,
        rosterId: null,
        observerId: adviserId,
        sectionId: student.sectionId,
        observationDatetime: observedAt,
        descriptionOfIncident: spec.incident,
        descriptionOfLocation: spec.location,
        notesRecommendationsActions: spec.notes,
        classPerformance: spec.classPerformance,
        attendanceSummary: spec.attendanceSummary,
        category: spec.category,
        confidentialityLevel: "restricted",
        termId: term.id,
      },
    });

    const referral = await prisma.referral.create({
      data: {
        anecdotalRecordId: anecdotal.id,
        referredToRole: "adm_coordinator",
        referredBy: adviserId,
        reason: spec.reason,
        consultReviewer: spec.reviewer,
        consultReviewedAt: endorsedAt,
        referralFormReady: true,
        status: "in_progress",
        studentId: student.studentId,
        rosterId: null,
        termId: term.id,
      },
    });

    await prisma.auditLog.createMany({
      data: [
        {
          userId: adviserId,
          actionType: "anecdotal_edit",
          sourceTable: "anecdotal_records",
          sourceId: anecdotal.id,
          reason: "Anecdotal record filed",
          createdAt: observedAt,
        },
        {
          userId: adviserId,
          actionType: "referral_adm_initiated",
          sourceTable: "referrals",
          sourceId: referral.id,
          reason: `Referred to adm_coordinator (consult reviewer: ${spec.reviewer})`,
          createdAt: endorsedAt,
        },
      ],
    });

    console.log(
      `OK  ${student.lrn} (${student.fullName} / ${student.sectionName}) → consultation (early, no profile)`,
    );
    createdEarly++;
  }

  const deviceCount = await prisma.admDevice.count();
  console.log(
    `\nDone. ADM profiles created: ${createdProfiles}, early consultation referrals: ${createdEarly}.` +
      `\nTotal ADM profiles now: ${await prisma.admLearnerProfile.count()}; devices: ${deviceCount}.` +
      `\nCoordinator login: adm@zentra.test / Zentra2025!`,
  );
}

const FORM_TITLES: Record<AdmFormKind, string> = {
  REFERRAL_FORM: "Referral form",
  ANECDOTAL_REPORT: "Anecdotal report",
  CERTIFICATION: "ADM certification",
  MINUTES_OF_MEETING: "Minutes of meeting",
  HV_FORM: "Home visitation form",
};

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
