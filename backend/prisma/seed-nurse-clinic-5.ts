import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

// Seed 5 anecdotal records referred to the school nurse for NON-ADM matters:
//   referredToRole = "nurse", consultReviewer = null (regular clinic desk).
// These surface on /nurse/referrals (Referrals to me) and /nurse/alerts.
// Idempotent: skips roster entries that already have any referral, and caps
// at 5 new records per run.

const CASES = [
  {
    observationDaysAgo: 0,
    category: "health" as const,
    incident:
      "Student complained of headache and nausea during the second period; rested in the classroom but symptoms persisted, walked to the clinic with a classmate.",
    location: "Classroom",
    notes: "For clinic assessment and first-aid logging.",
    classPerformance: "Active participant; missed one activity today.",
    attendanceSummary: "Present daily this month.",
    reason: "Persistent headache and nausea during class — needs clinic assessment.",
  },
  {
    observationDaysAgo: 1,
    category: "health" as const,
    incident:
      "Student scraped left elbow on the corridor stairs; minor bleeding, wound cleaned with antiseptic at the scene, no swelling observed.",
    location: "Corridor stairs",
    notes: "Wound cleaning done; monitor for signs of infection.",
    classPerformance: "Doing well; returned to class after treatment.",
    attendanceSummary: "No absences this term.",
    reason: "Minor elbow abrasion from a fall — cleaned, needs clinic follow-up check.",
  },
  {
    observationDaysAgo: 2,
    category: "behavioral" as const,
    incident:
      "Student was unusually withdrawn and teary-eyed the whole morning; when asked, said they did not sleep well for several nights and feel exhausted.",
    location: "Classroom",
    notes: "Recommend a calm check-in at the clinic; watch for recurring fatigue.",
    classPerformance: "Grades steady; participation dropped this week.",
    attendanceSummary: "1 late arrival this week.",
    reason: "Unusual withdrawal and exhaustion over several days — needs clinic check-in.",
  },
  {
    observationDaysAgo: 3,
    category: "attendance" as const,
    incident:
      "Student reported feeling dizzy every morning before flag ceremony; admits to skipping breakfast regularly.",
    location: "Flag ceremony grounds",
    notes: "Nutrition and hydration counseling recommended at the clinic.",
    classPerformance: "Satisfactory; misses morning routines at times.",
    attendanceSummary: "3 tardy marks this month.",
    reason: "Recurring morning dizziness, skips breakfast — needs clinic nutrition counseling.",
  },
  {
    observationDaysAgo: 5,
    category: "academic" as const,
    incident:
      "Student complained of eye strain and difficulty reading the board from the back row; squints frequently during discussions.",
    location: "Classroom",
    notes: "Possible vision screening referral; consider front-row seating meanwhile.",
    classPerformance: "Struggling with board work; written outputs are fine.",
    attendanceSummary: "Present daily.",
    reason: "Frequent eye strain reading the board — needs clinic vision screening.",
  },
];

async function main() {
  const schoolYear = await prisma.schoolYear.findFirst({ where: { isActive: true } });
  if (!schoolYear) throw new Error("No active school year");
  const term = await prisma.term.findFirst({
    where: { schoolYearId: schoolYear.id, termNumber: 1 },
  });
  if (!term) throw new Error("No active term (Term 1)");

  // Roster candidates: real class sections with an adviser, newest first,
  // skipping anyone who already has any referral.
  const roster = await prisma.studentRoster.findMany({
    where: { schoolYearId: schoolYear.id, NOT: { sectionId: "xxxx-never" } },
    include: { section: { select: { id: true, name: true, adviserId: true } } },
    orderBy: { lrn: "desc" },
    take: 60,
  });
  const withRefs = await prisma.referral.findMany({
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
        status: created < 4 ? "pending" : "in_progress",
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

  const total = await prisma.referral.count({ where: { referredToRole: "nurse" } });
  console.log(`Done: created=${created} total nurse referrals=${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
