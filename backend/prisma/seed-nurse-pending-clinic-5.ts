import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

// Seed 5 anecdotal records referred to the school nurse for OTHER matters
// (regular clinic desk, NOT ADM):
//   referredToRole = "nurse", consultReviewer = null, status = "pending".
// Just referred — no action done by the nurse (no sessions, no intake).
// These surface on /nurse/referrals (Referrals to me) as type Clinic.
// Idempotent: skips roster entries that already have any nurse referral.

const CASES = [
  {
    observationDaysAgo: 0,
    category: "health" as const,
    incident:
      "Student vomited once after lunch and was brought to the classroom bench to rest; pale but responsive, no fever felt.",
    location: "Canteen",
    notes: "For clinic assessment; check hydration and temperature on arrival.",
    classPerformance: "Good standing; missed afternoon quiz today.",
    attendanceSummary: "Present daily this month.",
    reason: "Vomiting episode after lunch — needs clinic assessment.",
  },
  {
    observationDaysAgo: 1,
    category: "health" as const,
    incident:
      "Student nose-bled during PE warm-up; bleeding stopped after ten minutes of pressure, advised to avoid strenuous play today.",
    location: "PE grounds",
    notes: "Monitor for repeat nosebleeds; check blood pressure if recurrent.",
    classPerformance: "Active in PE; sits out contact games for now.",
    attendanceSummary: "No absences this term.",
    reason: "Nosebleed during PE warm-up — needs clinic monitoring.",
  },
  {
    observationDaysAgo: 2,
    category: "behavioral" as const,
    incident:
      "Student broke down crying during silent reading and said they feel scared to go home because a relative scolds them nightly.",
    location: "Classroom",
    notes: "Gentle clinic check-in; do not press for details on first visit.",
    classPerformance: "Grades slipping; drifts off mid-lesson.",
    attendanceSummary: "2 absences this month.",
    reason: "Crying episode over fear of going home — needs clinic check-in.",
  },
  {
    observationDaysAgo: 3,
    category: "health" as const,
    incident:
      "Student with known asthma wheezed after climbing three flights of stairs; rested with inhaler, breathing normalized.",
    location: "Stairwell",
    notes: "Review asthma action plan and inhaler technique at the clinic.",
    classPerformance: "Satisfactory; avoids stairs when possible.",
    attendanceSummary: "1 absence this term.",
    reason: "Asthma wheezing after stairs — needs clinic action-plan review.",
  },
  {
    observationDaysAgo: 4,
    category: "attendance" as const,
    incident:
      "Student dozed off three times before lunch and admitted playing online games until 2 a.m. again.",
    location: "Classroom",
    notes: "Sleep-habit counseling at the clinic; coordinate device curfew with parents.",
    classPerformance: "Falling behind on morning outputs.",
    attendanceSummary: "4 tardy marks this month.",
    reason: "Daytime sleepiness from all-night gaming — needs clinic sleep counseling.",
  },
];

async function main() {
  const schoolYear = await prisma.schoolYear.findFirst({ where: { isActive: true } });
  if (!schoolYear) throw new Error("No active school year");
  const term = await prisma.term.findFirst({
    where: { schoolYearId: schoolYear.id, termNumber: 1 },
  });
  if (!term) throw new Error("No active term (Term 1)");

  const roster = await prisma.studentRoster.findMany({
    where: { schoolYearId: schoolYear.id, NOT: { sectionId: "xxxx-never" } },
    include: { section: { select: { id: true, name: true, adviserId: true } } },
    orderBy: { lrn: "desc" },
    take: 400,
  });
  const withRefs = await prisma.referral.findMany({
    where: { OR: [{ referredToRole: "nurse" }, { consultReviewer: "nurse" }] },
    select: { rosterId: true, studentId: true },
  });
  const usedRoster = new Set(withRefs.map((r) => r.rosterId).filter(Boolean));
  const candidates = roster.filter(
    (r) => r.section.adviserId && !usedRoster.has(r.id) && !r.sectionId.startsWith("xxxx")
  );

  let created = 0;
  for (const c of CASES) {
    const target = candidates[created];
    if (!target) break;
    const observerId = target.section.adviserId!;
    const observedAt = new Date();
    observedAt.setDate(observedAt.getDate() - c.observationDaysAgo);
    observedAt.setHours(8, 30, 0, 0);

    const anecdotal = await prisma.anecdotalRecord.create({
      data: {
        rosterId: target.id,
        studentId: null,
        observerId,
        sectionId: target.sectionId,
        observationDatetime: observedAt,
        descriptionOfIncident: c.incident,
        descriptionOfLocation: c.location,
        notesRecommendationsActions: c.notes,
        classPerformance: c.classPerformance,
        attendanceSummary: c.attendanceSummary,
        category: c.category,
        confidentialityLevel: "restricted",
        termId: term.id,
      },
    });

    const referral = await prisma.referral.create({
      data: {
        anecdotalRecordId: anecdotal.id,
        referredToRole: "nurse",
        referredBy: observerId,
        reason: c.reason,
        consultReviewer: null,
        status: "pending",
        rosterId: target.id,
        studentId: null,
        termId: term.id,
      },
    });

    // Referral time on the nurse pages = earliest audit entry; mirror what
    // POST /api/anecdotal/:id/refer writes so "waiting" counts correctly.
    await prisma.auditLog.create({
      data: {
        userId: observerId,
        actionType: "referral_status_change",
        sourceTable: "referrals",
        sourceId: referral.id,
        reason: "Referred to nurse",
      },
    });

    console.log(
      `OK ${target.lrn} (${target.fullName} / ${target.section.name}): anecdotal ${anecdotal.id} -> referral ${referral.id} [${referral.status}]`
    );
    created++;
    usedRoster.add(target.id);
  }

  console.log(`Done: created=${created} (all pending, no nurse action)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
