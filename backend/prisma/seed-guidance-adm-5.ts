import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

// Seed 5 anecdotal records referred for ADM with the guidance counselor as
// consultation reviewer:
//   referredToRole = "adm_coordinator", consultReviewer = "guidance_counselor".
// These surface on /guidance/adm (consultation review queue).
// Idempotent: skips roster entries that already have any referral.

const CASES = [
  {
    observationDaysAgo: 0,
    category: "attendance" as const,
    incident:
      "Student has missed 12 class days this month without excuse letters; parents could not be reached by phone after three attempts.",
    location: "Classroom",
    notes: "Recommend ADM consultation: verify home situation, consider modular learning if absences continue.",
    classPerformance: "Failing two subjects due to missed lessons and outputs.",
    attendanceSummary: "12 absences, 4 tardy marks this month.",
    reason: "ADM consultation — chronic absenteeism (12 days); needs guidance review for modular learning.",
  },
  {
    observationDaysAgo: 1,
    category: "academic" as const,
    incident:
      "Student's grades fell from passing to failing in three subjects within one quarter; teacher notes the student stopped submitting modules entirely.",
    location: "Classroom",
    notes: "Recommend ADM consultation: assess whether home-based modules fit better than daily attendance.",
    classPerformance: "Failing Math, Science, and English this quarter.",
    attendanceSummary: "Present but unproductive; 2 absences.",
    reason: "ADM consultation — sharp academic decline across three subjects; needs guidance review.",
  },
  {
    observationDaysAgo: 2,
    category: "behavioral" as const,
    incident:
      "Student figured in three separate classroom disruptions this week, including walking out mid-lesson twice after disagreement with seatmates.",
    location: "Classroom",
    notes: "Recommend ADM consultation: structured setup with fewer triggers may help; review with parents present.",
    classPerformance: "Outputs incomplete; capable when focused one-on-one.",
    attendanceSummary: "Present daily; 1 guidance visit logged.",
    reason: "ADM consultation — repeated classroom disruptions and walkouts; needs guidance review.",
  },
  {
    observationDaysAgo: 4,
    category: "attendance" as const,
    incident:
      "Student travels over an hour each way and has started leaving school at lunch to catch the only jeepney home; afternoons are effectively missed.",
    location: "School gate",
    notes: "Recommend ADM consultation: distance setup qualifies for modular-afternoon consideration.",
    classPerformance: "Morning work satisfactory; afternoon outputs missing.",
    attendanceSummary: "Half-day pattern for two straight weeks.",
    reason: "ADM consultation — long commute forces half-days; needs guidance review for setup options.",
  },
  {
    observationDaysAgo: 6,
    category: "academic" as const,
    incident:
      "Working student renders night shifts at the market and sleeps through morning classes; teachers report head-on-desk episodes almost daily.",
    location: "Classroom",
    notes: "Recommend ADM consultation: evening-friendly module schedule could keep the student enrolled.",
    classPerformance: "Previously average; now failing quizzes from missed lessons.",
    attendanceSummary: "Present but asleep; 5 tardy marks.",
    reason: "ADM consultation — night-shift work wrecks school days; needs guidance review for flexible setup.",
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
    take: 80,
  });
  const withRefs = await prisma.referral.findMany({
    where: {
      referredToRole: "adm_coordinator",
      consultReviewer: "guidance_counselor",
      status: { in: ["pending", "in_progress"] },
    },
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
        referredToRole: "adm_coordinator",
        referredBy: observerId,
        reason: c.reason,
        consultReviewer: "guidance_counselor",
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
        reason: "Referred to adm_coordinator (consult reviewer: guidance_counselor)",
      },
    });

    console.log(
      `OK ${target.lrn} (${target.fullName} / ${target.section.name}): anecdotal ${anecdotal.id} -> referral ${referral.id} [${referral.status}]`
    );
    created++;
    usedRoster.add(target.id);
  }

  const total = await prisma.referral.count({
    where: { referredToRole: "adm_coordinator", consultReviewer: "guidance_counselor" },
  });
  console.log(`Done: created=${created} total guidance-ADM referrals=${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
