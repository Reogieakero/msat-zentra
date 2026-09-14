import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

// Seed exactly 5 anecdotal records, each referred as an ADM-track case with
// the school nurse as consultation reviewer:
//   referredToRole = "adm_coordinator", consultReviewer = "nurse", status = "pending"
// These surface on /nurse/alerts + /nurse/overview via GET /api/referrals/
// (nurse scope) and open through the nurse ADM review dialog.
// Idempotent: re-runs skip roster LRNs that already have a nurse-ADM referral.

const CASES = [
  {
    lrn: "20139272114",
    observationDaysAgo: 0,
    incident:
      "Student complained of recurring dizziness and headache during morning classes; observed pale and fatigued, sent to clinic for vitals check.",
    location: "Classroom (G7-A) / School clinic",
    notes:
      "Recommend ADM health consultation: possible need for modular schedule while undergoing medical check-up. Request nurse review.",
    classPerformance: "Previously participative; noticeably withdrawn this week.",
    attendanceSummary: "2 absences in the last 2 weeks (health-related).",
    reason: "ADM health consultation — recurring dizziness/headache; needs nurse review for possible modular arrangement.",
  },
  {
    lrn: "20110411563",
    observationDaysAgo: 1,
    incident:
      "Student sustained a minor sprain on the right ankle during P.E.; swelling observed, first aid applied, advised limited mobility.",
    location: "School grounds (P.E. area)",
    notes:
      "Recommend ADM consultation: limited mobility for 1-2 weeks. Request nurse assessment for home-based activity packets.",
    classPerformance: "Doing well; may miss P.E. and stair-heavy room transfers.",
    attendanceSummary: "Present daily; 1 late arrival this month.",
    reason: "ADM health consultation — ankle sprain with limited mobility; needs nurse review for activity packets.",
  },
  {
    lrn: "20110206647",
    observationDaysAgo: 2,
    incident:
      "Student reported persistent cough and sore throat for three days; temperature slightly elevated at clinic check.",
    location: "Classroom (G7-C)",
    notes:
      "Recommend ADM health review: possible contagious period. Request nurse guidance on temporary modular setup.",
    classPerformance: "Grades stable; concentration affected when coughing fits occur.",
    attendanceSummary: "1 absence last week; otherwise present.",
    reason: "ADM health consultation — persistent cough/fever; needs nurse review for temporary modular setup.",
  },
  {
    lrn: "20107031178",
    observationDaysAgo: 3,
    incident:
      "Student complained of stomach ache after lunch break; observed loss of appetite over two consecutive days.",
    location: "Canteen / Classroom (G8-B)",
    notes:
      "Recommend ADM consultation: needs dietary monitoring and possible clinic clearance. Request nurse assessment.",
    classPerformance: "Satisfactory; missed one quiz due to clinic visit.",
    attendanceSummary: "No absences; 2 clinic visits this month.",
    reason: "ADM health consultation — recurring stomach ache/loss of appetite; needs nurse assessment.",
  },
  {
    lrn: "20137162133",
    observationDaysAgo: 4,
    incident:
      "Student fainted briefly during flag ceremony; recovered after rest and hydration. History of skipping breakfast reported.",
    location: "Flag ceremony grounds",
    notes:
      "Recommend ADM health consultation: rule out underlying condition. Request nurse review for health plan and possible modular days.",
    classPerformance: "Good standing; one missed morning activity.",
    attendanceSummary: "Present daily; 1 recorded late.",
    reason: "ADM health consultation — fainting episode at flag ceremony; needs nurse review for health plan.",
  },
];

async function main() {
  const schoolYear = await prisma.schoolYear.findFirst({ where: { isActive: true } });
  if (!schoolYear) throw new Error("No active school year");
  const term = await prisma.term.findFirst({
    where: { schoolYearId: schoolYear.id, termNumber: 1 },
  });
  if (!term) throw new Error("No active term (Term 1)");

  let created = 0;
  let skipped = 0;

  for (const c of CASES) {
    const roster = await prisma.studentRoster.findFirst({
      where: { lrn: c.lrn, schoolYearId: schoolYear.id },
      include: { section: { select: { id: true, name: true, adviserId: true } } },
    });
    if (!roster) {
      console.log(`SKIP ${c.lrn}: roster entry not found`);
      skipped++;
      continue;
    }
    const sectionId = roster.sectionId;
    const observerId = roster.section.adviserId;
    if (!observerId) {
      console.log(`SKIP ${c.lrn}: section ${roster.section.name} has no adviser`);
      skipped++;
      continue;
    }
    const existing = await prisma.referral.findFirst({
      where: {
        rosterId: roster.id,
        referredToRole: "adm_coordinator",
        consultReviewer: "nurse",
        status: { in: ["pending", "in_progress"] },
      },
      select: { id: true },
    });
    if (existing) {
      console.log(`SKIP ${c.lrn}: already has nurse-ADM referral ${existing.id}`);
      skipped++;
      continue;
    }

    const observedAt = new Date();
    observedAt.setDate(observedAt.getDate() - c.observationDaysAgo);
    observedAt.setHours(8, 30, 0, 0);

    const anecdotal = await prisma.anecdotalRecord.create({
      data: {
        rosterId: roster.id,
        studentId: null,
        observerId,
        sectionId,
        observationDatetime: observedAt,
        descriptionOfIncident: c.incident,
        descriptionOfLocation: c.location,
        notesRecommendationsActions: c.notes,
        classPerformance: c.classPerformance,
        attendanceSummary: c.attendanceSummary,
        category: "health",
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
        rosterId: roster.id,
        studentId: null,
        termId: term.id,
      },
    });

    // Referral time on /nurse/alerts = earliest audit entry; mirror what
    // POST /api/anecdotal/:id/refer writes so "waiting" counts correctly.
    await prisma.auditLog.create({
      data: {
        userId: observerId,
        actionType: "referral_status_change",
        sourceTable: "referrals",
        sourceId: referral.id,
        reason: "Referred to adm_coordinator (consult reviewer: nurse)",
      },
    });

    console.log(`OK ${c.lrn} (${roster.fullName} / ${roster.section.name}): anecdotal ${anecdotal.id} -> referral ${referral.id}`);
    created++;
  }

  const total = await prisma.referral.count({
    where: { referredToRole: "adm_coordinator", consultReviewer: "nurse" },
  });
  console.log(`Done: created=${created} skipped=${skipped} total nurse-ADM referrals=${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
