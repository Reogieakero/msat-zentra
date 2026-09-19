import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

// Seed 5 anecdotal records referred for ADM with the guidance counselor as
// consultation reviewer:
//   referredToRole = "adm_coordinator", consultReviewer = "guidance_counselor",
//   status = "pending".
// Just referred — no action done by guidance (no review, no session).
// These surface in the guidance ADM consultation queue as cases that need
// review (decide: endorse to the ADM coordinator or reject).
// Idempotent: skips roster entries that already have a guidance-picked ADM
// referral.

const CASES = [
  {
    observationDaysAgo: 0,
    category: "academic" as const,
    incident:
      "Student failed all five written outputs this term despite attending remediation twice a week; adviser suspects the regular setup no longer fits and asks for ADM evaluation.",
    location: "Classroom",
    notes: "Recommend ADM consultation: evaluate for modular placement with documented remediation history.",
    classPerformance: "Failing across subjects despite remediation attendance.",
    attendanceSummary: "Present daily; attends remediation.",
    reason: "ADM consultation — zero passing outputs despite remediation; needs guidance review.",
  },
  {
    observationDaysAgo: 1,
    category: "behavioral" as const,
    incident:
      "Student figured in three separate classroom disruptions this week, including walking out mid-lesson twice; talks with the adviser have not changed the pattern.",
    location: "Classroom",
    notes: "Recommend ADM consultation: behavior contract with parent involvement and monitored follow-through.",
    classPerformance: "Outputs incomplete; participation withdrawn.",
    attendanceSummary: "Present daily.",
    reason: "ADM consultation — repeated classroom disruptions unresponsive to talks; needs guidance review.",
  },
  {
    observationDaysAgo: 2,
    category: "attendance" as const,
    incident:
      "Student has 14 absences this quarter with no valid excuse on file; parents say the student leaves home on time but arrives hours late or not at all.",
    location: "School gate log",
    notes: "Recommend ADM consultation: home visitation track to confirm the daily routine and guardianship setup.",
    classPerformance: "Failing two subjects from missed lessons.",
    attendanceSummary: "14 absences, mostly unexcused.",
    reason: "ADM consultation — chronic unexcused absences; needs guidance review for home visit track.",
  },
  {
    observationDaysAgo: 3,
    category: "bullying" as const,
    incident:
      "Student reported being threatened by an older student for three straight days and now refuses to go to the canteen or restroom alone; guidance talks helped but the fear persists.",
    location: "Canteen area",
    notes: "Recommend ADM consultation: formal case handling with parent conference and section-level monitoring.",
    classPerformance: "Withdrawing; grades slipping since the incidents.",
    attendanceSummary: "Present daily; avoids common areas.",
    reason: "ADM consultation — persistent bullying fear after initial talks; needs guidance review.",
  },
  {
    observationDaysAgo: 5,
    category: "academic" as const,
    incident:
      "Student submitted no performance-task outputs for two consecutive quarters; family asks whether ADM modular learning is an option the school can formally assess.",
    location: "Classroom",
    notes: "Recommend ADM consultation: assess modular eligibility with family conference on record.",
    classPerformance: "No performance-task outputs for two quarters.",
    attendanceSummary: "Present daily; unproductive.",
    reason: "ADM consultation — family requests modular assessment; needs guidance review.",
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

  console.log(`Done: created=${created} (all pending, no guidance action)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
