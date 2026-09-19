import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

// Seed 5 guidance-desk referrals of ADM type for /guidance/referrals:
//   referredToRole = "guidance_counselor", escalatedTo = "adm_coordinator",
//   status = "escalated" (type badge reads ADM).
// Just referred + sent toward ADM — no sessions, no resolution.
// Idempotent: skips roster entries that already have a guidance referral.

const CASES = [
  {
    observationDaysAgo: 1,
    category: "bullying" as const,
    incident:
      "Student was cornered by three older students behind the canteen and threatened for lunch money twice this week; too afraid to report until the adviser noticed missing allowance.",
    location: "Behind the canteen",
    notes: "Severity beyond counseling alone — needs ADM follow-through with parents and section advisers.",
    classPerformance: "Withdrawing; grades slipping since the incidents.",
    attendanceSummary: "Present daily; avoids recess areas.",
    reason: "Extortion-style bullying by older students — sent toward ADM for formal follow-through.",
    escalationReason: "Repeated threats need ADM-level case handling beyond counseling sessions.",
  },
  {
    observationDaysAgo: 2,
    category: "behavioral" as const,
    incident:
      "Student brought a cutter to school and threatened a seatmate during a quarrel; object confiscated, no one hurt, parents called in the same hour.",
    location: "Classroom",
    notes: "Danger-level incident — needs ADM track with documented behavior contract.",
    classPerformance: "Suspended from group activities pending review.",
    attendanceSummary: "Present daily this quarter.",
    reason: "Brought a cutter and threatened a seatmate — sent toward ADM for behavior contract.",
    escalationReason: "Weapon-related threat needs ADM-level documentation and monitoring.",
  },
  {
    observationDaysAgo: 3,
    category: "attendance" as const,
    incident:
      "Student has 18 absences this quarter with forged excuse letters discovered; parents claim unawareness when called.",
    location: "Classroom",
    notes: "Truancy with forgery — needs ADM track with home visitation component.",
    classPerformance: "Failing four subjects from missed lessons.",
    attendanceSummary: "18 absences, forged excuses confirmed.",
    reason: "Truancy with forged excuse letters — sent toward ADM for home visit track.",
    escalationReason: "Forged documents plus truancy need ADM-level home follow-through.",
  },
  {
    observationDaysAgo: 5,
    category: "academic" as const,
    incident:
      "Student has not submitted a single output all term despite repeated remediation invites; parents request modular setup which counseling alone cannot approve.",
    location: "Classroom",
    notes: "Zero-output term — needs ADM evaluation for modular placement.",
    classPerformance: "No outputs on record this term.",
    attendanceSummary: "Present daily; unproductive.",
    reason: "Zero outputs all term, family requests modular setup — sent toward ADM for evaluation.",
    escalationReason: "Placement decision needs ADM-level evaluation and approval.",
  },
  {
    observationDaysAgo: 7,
    category: "behavioral" as const,
    incident:
      "Student caught vaping inside the restroom with two others; devices confiscated, all three admitted repeated use on campus.",
    location: "Restroom",
    notes: "Group violation — needs ADM track with coordinated parent conferences.",
    classPerformance: "Slipping; frequent restroom breaks noted.",
    attendanceSummary: "Present daily.",
    reason: "Group vaping on campus — sent toward ADM for coordinated parent conferences.",
    escalationReason: "Group misconduct needs ADM-level coordinated conferences.",
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
        status: "escalated",
        escalatedTo: "adm_coordinator",
        escalationReason: c.escalationReason,
        rosterId: target.id,
        studentId: null,
        termId: term.id,
      },
    });

    await prisma.auditLog.createMany({
      data: [
        {
          userId: observerId,
          actionType: "referral_status_change",
          sourceTable: "referrals",
          sourceId: referral.id,
          reason: "Referred to guidance_counselor",
        },
        {
          userId: observerId,
          actionType: "referral_escalated",
          sourceTable: "referrals",
          sourceId: referral.id,
          reason: c.escalationReason,
        },
      ],
    });

    console.log(
      `OK ${target.lrn} (${target.fullName} / ${target.section.name}): anecdotal ${anecdotal.id} -> referral ${referral.id} [escalated>adm_coordinator]`
    );
    created++;
    usedRoster.add(target.id);
  }

  console.log(`Done: created=${created} (ADM-type, sent toward ADM, untouched otherwise)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
