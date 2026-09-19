import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

// Seed 5 anecdotal records referred for ADM with the school nurse as
// consultation reviewer:
//   referredToRole = "adm_coordinator", consultReviewer = "nurse",
//   status = "pending".
// Just referred — no action done by the nurse (no review, no session).
// These surface on /nurse/referrals (Referrals to me) as type ADM.
// Idempotent: skips roster entries that already have any nurse referral.

const CASES = [
  {
    observationDaysAgo: 0,
    category: "health" as const,
    incident:
      "Student collapsed briefly during the flag ceremony and recovered after lying down; no injury, but teachers worry about a repeat episode.",
    location: "Flag ceremony grounds",
    notes: "Recommend ADM health consultation: rule out underlying condition and set a health plan.",
    classPerformance: "Good standing; missed today's morning activity.",
    attendanceSummary: "Present daily; 1 recorded late.",
    reason: "ADM health consultation — brief collapse at flag ceremony; needs nurse review.",
  },
  {
    observationDaysAgo: 1,
    category: "health" as const,
    incident:
      "Student's skin rashes flared across both arms, scratching until skin broke; teacher suspects allergy but family has no maintenance meds.",
    location: "Classroom",
    notes: "Recommend ADM health consultation: dermatology referral and classroom seating away from chalk dust.",
    classPerformance: "Distracted by itching; outputs still submitted.",
    attendanceSummary: "No absences this term.",
    reason: "ADM health consultation — severe skin flare-ups; needs nurse review for care plan.",
  },
  {
    observationDaysAgo: 2,
    category: "health" as const,
    incident:
      "Student disclosed frequent stomach pain every school morning and has vomited twice this week before first period.",
    location: "Classroom",
    notes: "Recommend ADM health consultation: medical workup before considering schedule adjustments.",
    classPerformance: "Missing first-period outputs regularly.",
    attendanceSummary: "Present but ill most mornings.",
    reason: "ADM health consultation — recurring morning stomach pain; needs nurse review.",
  },
  {
    observationDaysAgo: 3,
    category: "behavioral" as const,
    incident:
      "Student hyperventilated during a graded recitation and had to be walked out to calm down; says recitations trigger panic.",
    location: "Classroom",
    notes: "Recommend ADM health consultation: anxiety screening and possible assessment accommodations.",
    classPerformance: "Strong written work; oral recitation is the trigger.",
    attendanceSummary: "Present daily.",
    reason: "ADM health consultation — panic during recitations; needs nurse review.",
  },
  {
    observationDaysAgo: 5,
    category: "health" as const,
    incident:
      "Student with a heart murmur history tired unusually fast in PE and sat out twice complaining of chest tightness.",
    location: "PE grounds",
    notes: "Recommend ADM health consultation: cardiology clearance before further PE participation.",
    classPerformance: "Excused from PE pending clearance.",
    attendanceSummary: "Present daily this month.",
    reason: "ADM health consultation — chest tightness in PE with murmur history; needs nurse review.",
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
    where: {
      referredToRole: "adm_coordinator",
      consultReviewer: "nurse",
      status: { in: ["pending", "in_progress"] },
    },
    select: { rosterId: true, studentId: true },
  });
  const usedRoster = new Set(withRefs.map((r) => r.rosterId).filter(Boolean));
  const candidates = roster.filter(
    (r) => r.section.adviserId && !usedRoster.has(r.id) && !r.sectionId.startsWith("xxxx")
  );

  let created = 0;
  // SEED_COUNT caps how many of CASES to create (default: all).
  const limit = Math.max(0, Number(process.env.SEED_COUNT) || CASES.length);
  for (const c of CASES.slice(0, limit)) {
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
        referredToRole: "adm_coordinator",
        referredBy: observerId,
        reason: c.reason,
        consultReviewer: "nurse",
        status: "pending",
        rosterId: target.id,
        studentId: null,
        termId: term.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: observerId,
        actionType: "referral_status_change",
        sourceTable: "referrals",
        sourceId: referral.id,
        reason: "Referred to adm_coordinator (consult reviewer: nurse)",
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
