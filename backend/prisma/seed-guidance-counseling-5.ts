import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

// Seed 5 anecdotal records referred to the guidance counselor for
// NON-ADM matters (guidance counseling track):
//   referredToRole = "guidance_counselor", consultReviewer = null.
// These surface on /guidance/referrals (Referrals to me) as type Counseling.
// Idempotent: skips roster entries that already have any referral.

const CASES = [
  {
    observationDaysAgo: 0,
    category: "bullying" as const,
    incident:
      "Student reported that two classmates repeatedly hide their bag and call them names during recess; cried while recounting the latest incident.",
    location: "Playground",
    notes: "Needs counseling intake; monitor the named classmates separately.",
    classPerformance: "Previously active; now quiet and avoids group work.",
    attendanceSummary: "Present daily; asked to go home early once.",
    reason: "Reported peer bullying at recess — needs guidance counseling intake.",
  },
  {
    observationDaysAgo: 1,
    category: "behavioral" as const,
    incident:
      "Student slammed their chair and shouted at a seatmate after losing a classroom game; refused to apologize and left the room.",
    location: "Classroom",
    notes: "Anger-management counseling recommended; loop in parents if repeated.",
    classPerformance: "Average; incidents cluster around competitive activities.",
    attendanceSummary: "No absences this term.",
    reason: "Outburst after classroom game — needs guidance counseling on self-control.",
  },
  {
    observationDaysAgo: 2,
    category: "academic" as const,
    incident:
      "Student failed all three quizzes this week and told the teacher they have 'given up' because lessons move too fast to follow.",
    location: "Classroom",
    notes: "Study-habit counseling plus remediation plan with subject teachers.",
    classPerformance: "Failing quizzes; outputs submitted but incomplete.",
    attendanceSummary: "Present daily.",
    reason: "Giving up on lessons moving too fast — needs guidance study counseling.",
  },
  {
    observationDaysAgo: 3,
    category: "attendance" as const,
    incident:
      "Student has been late six times in two weeks, each time saying they overslept after late-night mobile gaming.",
    location: "School gate",
    notes: "Habit counseling; agree on a device curfew with parents.",
    classPerformance: "Satisfactory when present for full periods.",
    attendanceSummary: "6 tardy marks in two weeks.",
    reason: "Chronic tardiness from late-night gaming — needs guidance habit counseling.",
  },
  {
    observationDaysAgo: 5,
    category: "behavioral" as const,
    incident:
      "Student was caught copying a seatmate's test paper; admitted feeling pressured by failing grades at home.",
    location: "Classroom",
    notes: "Integrity counseling; address grade pressure with parents present.",
    classPerformance: "Borderline failing; test scores inconsistent with seatwork.",
    attendanceSummary: "Present daily this month.",
    reason: "Caught cheating on a test over grade pressure — needs guidance counseling.",
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
    where: { referredToRole: "guidance_counselor" },
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
        referredToRole: "guidance_counselor",
        referredBy: observerId,
        reason: c.reason,
        consultReviewer: null,
        status: created < 4 ? "pending" : "in_progress",
        rosterId: target.id,
        studentId: null,
        termId: term.id,
      },
    });

    // Referral time on the guidance pages = earliest audit entry; mirror
    // what POST /api/anecdotal/:id/refer writes so sorting works.
    await prisma.auditLog.create({
      data: {
        userId: observerId,
        actionType: "referral_status_change",
        sourceTable: "referrals",
        sourceId: referral.id,
        reason: "Referred to guidance_counselor",
      },
    });

    console.log(
      `OK ${target.lrn} (${target.fullName} / ${target.section.name}): anecdotal ${anecdotal.id} -> referral ${referral.id} [${referral.status}]`
    );
    created++;
    usedRoster.add(target.id);
  }

  const total = await prisma.referral.count({ where: { referredToRole: "guidance_counselor" } });
  console.log(`Done: created=${created} total guidance referrals=${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
