import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

// Seeds the school-nurse desk with up to SEED_COUNT (default 10) records per
// nurse transaction so every nurse page renders a full workday:
//   - Overview / Clinic Matters: pending review, booked sessions, done
//     sessions, follow-ups, info requests, escalations, resolved, closed.
//   - ADM Cases / Referrals Report: pending review, referral form ready,
//     endorsed to ADM, rejected.
//   - Health Records: completed-session + resolved documentaries.
//   - Alerts: derived from the above + nurse notifications.
// Statuses/notes mirror the real service flow (services/referrals/*) so the
// UI's deriveActionStatus/parseSavedNurseAdmForm read them correctly.
// Idempotent-by-target: existing rows in a bucket count toward the target, so
// re-runs only top up. Safe to run after other seeds.
//
// Run: npx tsx prisma/seed-nurse-workflow.ts

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

const TARGET = Math.max(0, Number(process.env.SEED_COUNT) || 10);
const DAY_MS = 86_400_000;

function at(daysFromToday: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d;
}

interface CaseText {
  category: "health" | "behavioral" | "academic" | "attendance" | "bullying";
  incident: string;
  location: string;
  notes: string;
  classPerformance: string;
  attendanceSummary: string;
  reason: string;
}

// Clinic scenarios — reused across buckets (different students each time) so
// the desk reads like real logged cases without 100+ bespoke write-ups.
const CLINIC_CASES: CaseText[] = [
  {
    category: "health",
    incident:
      "Student complained of headache and nausea during the second period; rested in the classroom but symptoms persisted, walked to the clinic with a classmate.",
    location: "Classroom",
    notes: "For clinic assessment and first-aid logging.",
    classPerformance: "Active participant; missed one activity today.",
    attendanceSummary: "Present daily this month.",
    reason: "Persistent headache and nausea during class — needs clinic assessment.",
  },
  {
    category: "health",
    incident:
      "Student scraped left elbow on the corridor stairs; minor bleeding, wound cleaned with antiseptic at the scene, no swelling observed.",
    location: "Corridor stairs",
    notes: "Wound cleaning done; monitor for signs of infection.",
    classPerformance: "Doing well; returned to class after treatment.",
    attendanceSummary: "No absences this term.",
    reason: "Minor elbow abrasion from a fall — cleaned, needs clinic follow-up check.",
  },
  {
    category: "behavioral",
    incident:
      "Student was unusually withdrawn and teary-eyed the whole morning; when asked, said they did not sleep well for several nights and feel exhausted.",
    location: "Classroom",
    notes: "Recommend a calm check-in at the clinic; watch for recurring fatigue.",
    classPerformance: "Grades steady; participation dropped this week.",
    attendanceSummary: "1 late arrival this week.",
    reason: "Unusual withdrawal and exhaustion over several days — needs clinic check-in.",
  },
  {
    category: "attendance",
    incident:
      "Student reported feeling dizzy every morning before flag ceremony; admits to skipping breakfast regularly.",
    location: "Flag ceremony grounds",
    notes: "Nutrition and hydration counseling recommended at the clinic.",
    classPerformance: "Satisfactory; misses morning routines at times.",
    attendanceSummary: "3 tardy marks this month.",
    reason: "Recurring morning dizziness, skips breakfast — needs clinic nutrition counseling.",
  },
  {
    category: "academic",
    incident:
      "Student complained of eye strain and difficulty reading the board from the back row; squints frequently during discussions.",
    location: "Classroom",
    notes: "Possible vision screening referral; consider front-row seating meanwhile.",
    classPerformance: "Struggling with board work; written outputs are fine.",
    attendanceSummary: "Present daily.",
    reason: "Frequent eye strain reading the board — needs clinic vision screening.",
  },
  {
    category: "health",
    incident:
      "Student with known asthma wheezed after climbing three flights of stairs; rested with inhaler, breathing normalized.",
    location: "Stairwell",
    notes: "Review asthma action plan and inhaler technique at the clinic.",
    classPerformance: "Satisfactory; avoids stairs when possible.",
    attendanceSummary: "1 absence this term.",
    reason: "Asthma wheezing after stairs — needs clinic action-plan review.",
  },
  {
    category: "attendance",
    incident:
      "Student dozed off three times before lunch and admitted playing online games until 2 a.m. again.",
    location: "Classroom",
    notes: "Sleep-habit counseling at the clinic; coordinate device curfew with parents.",
    classPerformance: "Falling behind on morning outputs.",
    attendanceSummary: "4 tardy marks this month.",
    reason: "Daytime sleepiness from all-night gaming — needs clinic sleep counseling.",
  },
  {
    category: "health",
    incident:
      "Student vomited once after lunch and was brought to the classroom bench to rest; pale but responsive, no fever felt.",
    location: "Canteen",
    notes: "For clinic assessment; check hydration and temperature on arrival.",
    classPerformance: "Good standing; missed afternoon quiz today.",
    attendanceSummary: "Present daily this month.",
    reason: "Vomiting episode after lunch — needs clinic assessment.",
  },
  {
    category: "health",
    incident:
      "Student nose-bled during PE warm-up; bleeding stopped after ten minutes of pressure, advised to avoid strenuous play today.",
    location: "PE grounds",
    notes: "Monitor for repeat nosebleeds; check blood pressure if recurrent.",
    classPerformance: "Active in PE; sits out contact games for now.",
    attendanceSummary: "No absences this term.",
    reason: "Nosebleed during PE warm-up — needs clinic monitoring.",
  },
  {
    category: "behavioral",
    incident:
      "Student broke down crying during silent reading and said they feel scared to go home because a relative scolds them nightly.",
    location: "Classroom",
    notes: "Gentle clinic check-in; do not press for details on first visit.",
    classPerformance: "Grades slipping; drifts off mid-lesson.",
    attendanceSummary: "2 absences this month.",
    reason: "Crying episode over fear of going home — needs clinic check-in.",
  },
  {
    category: "health",
    incident:
      "Student complained of stomach ache after lunch break; observed loss of appetite over two consecutive days.",
    location: "Canteen / Classroom",
    notes: "Dietary monitoring; possible clinic clearance if repeated.",
    classPerformance: "Satisfactory; missed one quiz due to clinic visit.",
    attendanceSummary: "No absences; 2 clinic visits this month.",
    reason: "Recurring stomach ache and appetite loss — needs clinic monitoring.",
  },
  {
    category: "health",
    incident:
      "Student's skin rashes flared across both arms, scratching until skin broke; teacher suspects allergy but family has no maintenance meds.",
    location: "Classroom",
    notes: "Check allergy history; consider dermatology referral if unresolved.",
    classPerformance: "Distracted by itching; outputs still submitted.",
    attendanceSummary: "No absences this term.",
    reason: "Severe skin flare-ups — needs clinic care plan.",
  },
];

// ADM consultation scenarios — nurse reviews these before the coordinator
// can act (GCForm-03 consultation flow).
const ADM_CASES: CaseText[] = [
  {
    category: "health",
    incident:
      "Student complained of recurring dizziness and headache during morning classes; observed pale and fatigued, sent to clinic for vitals check.",
    location: "Classroom / School clinic",
    notes: "Possible need for modular schedule while undergoing medical check-up.",
    classPerformance: "Previously participative; noticeably withdrawn this week.",
    attendanceSummary: "2 absences in the last 2 weeks (health-related).",
    reason: "ADM health consultation — recurring dizziness/headache; needs nurse review for possible modular arrangement.",
  },
  {
    category: "health",
    incident:
      "Student sustained a minor sprain on the right ankle during P.E.; swelling observed, first aid applied, advised limited mobility.",
    location: "School grounds (P.E. area)",
    notes: "Limited mobility for 1–2 weeks; assessment for home-based activity packets.",
    classPerformance: "Doing well; may miss P.E. and stair-heavy room transfers.",
    attendanceSummary: "Present daily; 1 late arrival this month.",
    reason: "ADM health consultation — ankle sprain with limited mobility; needs nurse review for activity packets.",
  },
  {
    category: "health",
    incident:
      "Student reported persistent cough and sore throat for three days; temperature slightly elevated at clinic check.",
    location: "Classroom",
    notes: "Possible contagious period; guidance needed on temporary modular setup.",
    classPerformance: "Grades stable; concentration affected when coughing fits occur.",
    attendanceSummary: "1 absence last week; otherwise present.",
    reason: "ADM health consultation — persistent cough/fever; needs nurse review for temporary modular setup.",
  },
  {
    category: "health",
    incident:
      "Student fainted briefly during flag ceremony; recovered after rest and hydration. History of skipping breakfast reported.",
    location: "Flag ceremony grounds",
    notes: "Rule out underlying condition; health plan and possible modular days.",
    classPerformance: "Good standing; one missed morning activity.",
    attendanceSummary: "Present daily; 1 recorded late.",
    reason: "ADM health consultation — fainting episode at flag ceremony; needs nurse review for health plan.",
  },
  {
    category: "health",
    incident:
      "Student collapsed briefly during the flag ceremony and recovered after lying down; no injury, but teachers worry about a repeat episode.",
    location: "Flag ceremony grounds",
    notes: "Rule out underlying condition and set a health plan.",
    classPerformance: "Good standing; missed today's morning activity.",
    attendanceSummary: "Present daily; 1 recorded late.",
    reason: "ADM health consultation — brief collapse at flag ceremony; needs nurse review.",
  },
  {
    category: "health",
    incident:
      "Student disclosed frequent stomach pain every school morning and has vomited twice this week before first period.",
    location: "Classroom",
    notes: "Medical workup before considering schedule adjustments.",
    classPerformance: "Missing first-period outputs regularly.",
    attendanceSummary: "Present but ill most mornings.",
    reason: "ADM health consultation — recurring morning stomach pain; needs nurse review.",
  },
  {
    category: "behavioral",
    incident:
      "Student hyperventilated during a graded recitation and had to be walked out to calm down; says recitations trigger panic.",
    location: "Classroom",
    notes: "Anxiety screening and possible assessment accommodations.",
    classPerformance: "Strong written work; oral recitation is the trigger.",
    attendanceSummary: "Present daily.",
    reason: "ADM health consultation — panic during recitations; needs nurse review.",
  },
  {
    category: "health",
    incident:
      "Student with a heart murmur history tired unusually fast in PE and sat out twice complaining of chest tightness.",
    location: "PE grounds",
    notes: "Cardiology clearance before further PE participation.",
    classPerformance: "Excused from PE pending clearance.",
    attendanceSummary: "Present daily this month.",
    reason: "ADM health consultation — chest tightness in PE with murmur history; needs nurse review.",
  },
  {
    category: "health",
    incident:
      "Student has had on-and-off fever for five days and missed three consecutive class days; family cannot afford a check-up yet.",
    location: "Home / Classroom follow-up",
    notes: "Clinic assistance for check-up and clearance before returning to full load.",
    classPerformance: "Falling behind on all subjects this week.",
    attendanceSummary: "3 consecutive absences this week.",
    reason: "ADM health consultation — recurring fever with consecutive absences; needs nurse review for support.",
  },
  {
    category: "health",
    incident:
      "Student reports blurred vision and frequent headaches after long screen time; grades dropped in subjects with projector-heavy lessons.",
    location: "Classroom",
    notes: "Vision screening and screen-time guidance before schedule changes.",
    classPerformance: "Declining outputs in projector-based subjects.",
    attendanceSummary: "Present daily.",
    reason: "ADM health consultation — blurred vision and headaches; needs nurse review.",
  },
  {
    category: "health",
    incident:
      "Student is recovering from a fracture and uses crutches; cannot safely move between the fourth-floor rooms and the clinic.",
    location: "School grounds",
    notes: "Temporary rooming/modular arrangement while mobility is limited.",
    classPerformance: "Catching up well given the injury.",
    attendanceSummary: "Present when mobility support is available.",
    reason: "ADM health consultation — post-fracture mobility limits; needs nurse review for rooming/modular setup.",
  },
  {
    category: "behavioral",
    incident:
      "Student has missed morning classes six times this month complaining of severe migraines; no medical documentation on file yet.",
    location: "Classroom / Home",
    notes: "Medical workup plus attendance documentation before any ADM arrangement.",
    classPerformance: "Inconsistent morning performance.",
    attendanceSummary: "6 morning absences this month.",
    reason: "ADM health consultation — recurring migraines with attendance impact; needs nurse review.",
  },
];

interface Candidate {
  id: string;
  lrn: string | null;
  fullName: string;
  sectionId: string;
  sectionName: string;
  adviserId: string | null;
}

async function main() {
  // Server-side term scope for non-teacher desks = date-picked term of the
  // active year (lib/termScope.pickCurrentTerm). Seeding Term 1 would be
  // invisible mid-year, so resolve the same way the API does.
  const year = await prisma.schoolYear.findFirst({
    where: { isActive: true },
    select: {
      id: true,
      terms: {
        orderBy: { termNumber: "asc" },
        select: { id: true, termNumber: true, startDate: true, endDate: true },
      },
    },
  });
  if (!year) throw new Error("No active school year");
  const today = new Date().toISOString().slice(0, 10);
  const day = (d: Date | null, fallback: string) =>
    d ? d.toISOString().slice(0, 10) : fallback;
  const term =
    year.terms.find(
      (t) => day(t.startDate, "0000-01-01") <= today && today <= day(t.endDate, "9999-12-31"),
    ) ?? year.terms[0];
  if (!term) throw new Error("No term in the active school year");

  const nurse = await prisma.user.findFirstOrThrow({
    where: { role: "nurse", status: "active" },
  });
  const fallbackStaff = await prisma.user.findFirst({
    where: { role: { in: ["adviser", "subject_teacher"] }, status: "active" },
    select: { id: true },
  });
  if (!fallbackStaff) throw new Error("No adviser/subject teacher to attribute referrals to");

  // One referral per student keeps the desk readable; skip anyone who already
  // has a referral from earlier seeds or real use.
  const rosters = await prisma.studentRoster.findMany({
    where: {
      schoolYearId: year.id,
      NOT: { sectionId: { startsWith: "xxxx" } },
    },
    include: { section: { select: { id: true, name: true, adviserId: true } } },
    orderBy: { lrn: "desc" },
  });
  const taken = new Set(
    (await prisma.referral.findMany({ select: { rosterId: true } }))
      .map((r) => r.rosterId)
      .filter((id): id is string => !!id),
  );
  const candidates: Candidate[] = rosters
    .filter((r) => !taken.has(r.id))
    .map((r) => ({
      id: r.id,
      lrn: r.lrn,
      fullName: r.fullName,
      sectionId: r.sectionId,
      sectionName: r.section.name,
      adviserId: r.section.adviserId,
    }));
  if (candidates.length === 0) throw new Error("No roster candidates left without referrals");
  console.log(
    `Nurse ${nurse.fullName}; term ${term.termNumber}; ${candidates.length} candidate students`,
  );

  let cursor = 0;
  const nextCandidate = (): Candidate | null => {
    const c = candidates[cursor];
    cursor++;
    return c ?? null;
  };

  const referrerOf = (c: Candidate) => c.adviserId ?? fallbackStaff.id;

  // Create anecdotal + referral and the intake audit (the intake audit's
  // createdAt is what the queue shows as "referredAt", so backdate it).
  async function createReferral(opts: {
    candidate: Candidate;
    text: CaseText;
    referredToRole: "nurse" | "guidance_counselor" | "adm_coordinator";
    status: "pending" | "in_progress" | "follow_up" | "info_requested" | "resolved" | "dismissed" | "escalated";
    daysAgo: number;
    consultReviewer?: string;
    referrer?: string;
  }) {
    const referrer = opts.referrer ?? referrerOf(opts.candidate);
    const observedAt = at(-opts.daysAgo, 8, 30);
    const anecdotal = await prisma.anecdotalRecord.create({
      data: {
        rosterId: opts.candidate.id,
        studentId: null,
        observerId: referrer,
        sectionId: opts.candidate.sectionId,
        observationDatetime: observedAt,
        descriptionOfIncident: opts.text.incident,
        descriptionOfLocation: opts.text.location,
        notesRecommendationsActions: opts.text.notes,
        classPerformance: opts.text.classPerformance,
        attendanceSummary: opts.text.attendanceSummary,
        category: opts.text.category,
        confidentialityLevel: "restricted",
        termId: term.id,
      },
    });
    const referral = await prisma.referral.create({
      data: {
        anecdotalRecordId: anecdotal.id,
        referredToRole: opts.referredToRole,
        referredBy: referrer,
        reason: opts.text.reason,
        consultReviewer: opts.consultReviewer ?? null,
        status: opts.status,
        rosterId: opts.candidate.id,
        studentId: null,
        termId: term.id,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: referrer,
        actionType: "referral_status_change",
        sourceTable: "referrals",
        sourceId: referral.id,
        reason:
          opts.referredToRole === "nurse"
            ? "Referred to nurse"
            : opts.referredToRole === "adm_coordinator"
              ? "Referred to adm_coordinator (consult reviewer: nurse)"
              : "Referred to guidance_counselor",
        createdAt: observedAt,
      },
    });
    return { referral, referrer };
  }

  // Counts mirror the exact queues the nurse pages build, so "up to TARGET"
  // is judged against what is actually visible on the desk.
  const remain = (existing: number) => Math.max(0, TARGET - existing);
  const createdIds: string[] = [];

  // ---------------------------------------------------------------- CLINIC --

  {
    const existing = await prisma.referral.count({
      where: { referredToRole: "nurse", status: "pending" },
    });
    let made = 0;
    for (let i = 0; i < remain(existing); i++) {
      const c = nextCandidate();
      if (!c) break;
      const { referral } = await createReferral({
        candidate: c,
        text: CLINIC_CASES[i % CLINIC_CASES.length],
        referredToRole: "nurse",
        status: "pending",
        daysAgo: i % 8,
      });
      createdIds.push(referral.id);
      made++;
    }
    console.log(`clinic/pending (needs review): +${made} (existing ${existing})`);
  }

  {
    // Accepted with a first clinic session booked — "Booked session". Count
    // cases (not sessions): follow-up/resolved cases also carry sessions.
    const existing = await prisma.referral.count({
      where: {
        referredToRole: "nurse",
        status: "in_progress",
        counselingSessions: { some: { status: "scheduled" } },
      },
    });
    let made = 0;
    for (let i = 0; i < remain(existing); i++) {
      const c = nextCandidate();
      if (!c) break;
      const daysAgo = 1 + (i % 4);
      const { referral } = await createReferral({
        candidate: c,
        text: CLINIC_CASES[i % CLINIC_CASES.length],
        referredToRole: "nurse",
        status: "in_progress",
        daysAgo,
      });
      const scheduledAt = at(1 + (i % 6), 9 + (i % 5), (i % 2) * 30);
      const session = await prisma.counselingSession.create({
        data: {
          referralId: referral.id,
          sessionType: "individual",
          scheduledAt,
          venue: "School clinic",
          status: "scheduled",
          createdBy: nurse.id,
        },
      });
      await prisma.referral.update({
        where: { id: referral.id },
        data: { intakeNotes: "Accepted at the clinic; first session booked.", acceptedAt: at(-daysAgo, 10) },
      });
      await prisma.auditLog.create({
        data: {
          userId: nurse.id,
          actionType: "session_scheduled",
          sourceTable: "counseling_sessions",
          sourceId: session.id,
          reason: "First clinic session booked on accept",
          createdAt: at(-daysAgo, 10, 5),
        },
      });
      await prisma.auditLog.create({
        data: {
          userId: nurse.id,
          actionType: "referral_accepted",
          sourceTable: "referrals",
          sourceId: referral.id,
          reason: "Accepted by the clinic with a clinic session booked",
          createdAt: at(-daysAgo, 10),
        },
      });
      createdIds.push(referral.id);
      made++;
    }
    console.log(`clinic/booked session (in progress + scheduled): +${made} (existing ${existing})`);
  }

  {
    // Done session, case still open — the nurse's documentation trail. Only
    // sessions without an upcoming one render as "done session" (a scheduled
    // session takes display precedence), so count cases that way.
    const existing = await prisma.referral.count({
      where: {
        referredToRole: "nurse",
        status: "in_progress",
        counselingSessions: { some: { status: "completed" } },
        NOT: { counselingSessions: { some: { status: "scheduled" } } },
      },
    });
    let made = 0;
    for (let i = 0; i < remain(existing); i++) {
      const c = nextCandidate();
      if (!c) break;
      const daysAgo = 2 + (i % 5);
      const { referral } = await createReferral({
        candidate: c,
        text: CLINIC_CASES[(i + 3) % CLINIC_CASES.length],
        referredToRole: "nurse",
        status: "in_progress",
        daysAgo,
      });
      const done = await prisma.counselingSession.create({
        data: {
          referralId: referral.id,
          sessionType: "individual",
          scheduledAt: at(-daysAgo + 1, 10, 0),
          venue: "School clinic",
          status: "completed",
          sessionNotes: "Assessed in the clinic; vitals stable and first aid/care given.",
          outcome: "Condition improved; advised rest and hydration.",
          createdBy: nurse.id,
          completedAt: at(-daysAgo + 1, 10, 30),
        },
      });
      await prisma.auditLog.create({
        data: {
          userId: nurse.id,
          actionType: "session_completed",
          sourceTable: "counseling_sessions",
          sourceId: done.id,
          reason: "Clinic session completed",
          createdAt: at(-daysAgo + 1, 10, 30),
        },
      });
      createdIds.push(referral.id);
      made++;
    }
    console.log(`clinic/done session (in progress + completed): +${made} (existing ${existing})`);
  }

  {
    // Follow-up: one completed visit, then a follow-up booked (overdue and
    // upcoming mix so the alerts page shows both tones).
    const existing = await prisma.referral.count({
      where: { referredToRole: "nurse", status: "follow_up" },
    });
    let made = 0;
    for (let i = 0; i < remain(existing); i++) {
      const c = nextCandidate();
      if (!c) break;
      const daysAgo = 4 + (i % 5);
      const { referral } = await createReferral({
        candidate: c,
        text: CLINIC_CASES[(i + 6) % CLINIC_CASES.length],
        referredToRole: "nurse",
        status: "follow_up",
        daysAgo,
      });
      const overdue = i % 2 === 0;
      const followUpAt = overdue ? at(-(1 + (i % 4)), 9, 30) : at(2 + (i % 5), 10, 0);
      const done = await prisma.counselingSession.create({
        data: {
          referralId: referral.id,
          sessionType: "individual",
          scheduledAt: at(-daysAgo + 2, 10, 0),
          venue: "School clinic",
          status: "completed",
          sessionNotes: "Initial clinic visit done; monitoring symptoms at home.",
          outcome: "Needs one more check to close out.",
          createdBy: nurse.id,
          completedAt: at(-daysAgo + 2, 10, 30),
        },
      });
      await prisma.counselingSession.create({
        data: {
          referralId: referral.id,
          sessionType: "individual",
          scheduledAt: followUpAt,
          venue: "School clinic",
          status: "scheduled",
          createdBy: nurse.id,
        },
      });
      await prisma.referral.update({
        where: { id: referral.id },
        data: { followUpDate: followUpAt, intakeNotes: "Follow-up set after the first clinic visit." },
      });
      await prisma.auditLog.create({
        data: {
          userId: nurse.id,
          actionType: "session_completed",
          sourceTable: "counseling_sessions",
          sourceId: done.id,
          reason: "Clinic session completed",
          createdAt: at(-daysAgo + 2, 10, 30),
        },
      });
      await prisma.auditLog.create({
        data: {
          userId: nurse.id,
          actionType: "referral_follow_up",
          sourceTable: "referrals",
          sourceId: referral.id,
          reason: `Follow-up on ${followUpAt.toISOString().slice(0, 10)}`,
          createdAt: at(-daysAgo + 2, 11),
        },
      });
      createdIds.push(referral.id);
      made++;
    }
    console.log(`clinic/follow-up: +${made} (existing ${existing})`);
  }

  {
    const existing = await prisma.referral.count({
      where: { referredToRole: "nurse", status: "info_requested" },
    });
    let made = 0;
    for (let i = 0; i < remain(existing); i++) {
      const c = nextCandidate();
      if (!c) break;
      const daysAgo = 3 + (i % 5);
      const { referral } = await createReferral({
        candidate: c,
        text: CLINIC_CASES[(i + 2) % CLINIC_CASES.length],
        referredToRole: "nurse",
        status: "info_requested",
        daysAgo,
      });
      await prisma.referral.update({
        where: { id: referral.id },
        data: {
          notes: "Clinic needs the guardian's consent/medical history before proceeding.",
        },
      });
      await prisma.auditLog.create({
        data: {
          userId: nurse.id,
          actionType: "referral_status_change",
          sourceTable: "referrals",
          sourceId: referral.id,
          reason: "More information requested from the adviser",
          createdAt: at(-daysAgo + 1, 9),
        },
      });
      createdIds.push(referral.id);
      made++;
    }
    console.log(`clinic/info requested: +${made} (existing ${existing})`);
  }

  {
    // Escalated *to* the clinic by guidance — shows as the urgent queue item.
    const existing = await prisma.referral.count({
      where: { status: "escalated", escalatedTo: "nurse" },
    });
    const guidance = await prisma.user.findFirst({ where: { role: "guidance_counselor" } });
    let made = 0;
    if (guidance) {
      for (let i = 0; i < remain(existing); i++) {
        const c = nextCandidate();
        if (!c) break;
        const daysAgo = 1 + (i % 6);
        const { referral } = await createReferral({
          candidate: c,
          text: CLINIC_CASES[(i + 8) % CLINIC_CASES.length],
          referredToRole: "guidance_counselor",
          status: "escalated",
          daysAgo,
          referrer: guidance.id,
        });
        await prisma.referral.update({
          where: { id: referral.id },
          data: {
            escalatedTo: "nurse",
            escalationReason:
              "Behavioral concerns observed alongside physical symptoms — clinic assessment needed before counseling continues.",
          },
        });
        await prisma.auditLog.create({
          data: {
            userId: guidance.id,
            actionType: "referral_escalated",
            sourceTable: "referrals",
            sourceId: referral.id,
            reason: "Escalated to the clinic for assessment",
            createdAt: at(-daysAgo + 1, 10),
          },
        });
        createdIds.push(referral.id);
        made++;
      }
    }
    console.log(`clinic/escalated to nurse: +${made} (existing ${existing})`);
  }

  {
    // Resolved: completed session required by the service rules + closing
    // summary. Feeds Health Records closure entries and the "Resolved" alerts.
    const existing = await prisma.referral.count({
      where: { referredToRole: "nurse", status: "resolved" },
    });
    let made = 0;
    for (let i = 0; i < remain(existing); i++) {
      const c = nextCandidate();
      if (!c) break;
      const daysAgo = 6 + (i % 7);
      const { referral } = await createReferral({
        candidate: c,
        text: CLINIC_CASES[(i + 4) % CLINIC_CASES.length],
        referredToRole: "nurse",
        status: "in_progress",
        daysAgo,
      });
      const done = await prisma.counselingSession.create({
        data: {
          referralId: referral.id,
          sessionType: "individual",
          scheduledAt: at(-daysAgo + 2, 10, 0),
          venue: "School clinic",
          status: "completed",
          sessionNotes: "Treated at the clinic; guardian informed and care instructions given.",
          outcome: "Recovered — no further clinic visits needed.",
          createdBy: nurse.id,
          completedAt: at(-daysAgo + 2, 10, 45),
        },
      });
      const resolvedAt = at(-daysAgo + 3, 14);
      await prisma.referral.update({
        where: { id: referral.id },
        data: {
          status: "resolved",
          resolutionSummary:
            "Clinic care completed; symptoms resolved and guardian advised on home monitoring.",
          resolvedAt,
          acceptedAt: at(-daysAgo, 9),
        },
      });
      await prisma.auditLog.create({
        data: {
          userId: nurse.id,
          actionType: "session_completed",
          sourceTable: "counseling_sessions",
          sourceId: done.id,
          reason: "Clinic session completed",
          createdAt: at(-daysAgo + 2, 10, 45),
        },
      });
      await prisma.auditLog.create({
        data: {
          userId: nurse.id,
          actionType: "referral_status_change",
          sourceTable: "referrals",
          sourceId: referral.id,
          reason: "Status → resolved",
          createdAt: resolvedAt,
        },
      });
      createdIds.push(referral.id);
      made++;
    }
    console.log(`clinic/resolved: +${made} (existing ${existing})`);
  }

  {
    // Closed without clinic care (e.g. not a medical concern after triage).
    const existing = await prisma.referral.count({
      where: { referredToRole: "nurse", status: "dismissed" },
    });
    let made = 0;
    for (let i = 0; i < remain(existing); i++) {
      const c = nextCandidate();
      if (!c) break;
      const daysAgo = 5 + (i % 6);
      const { referral } = await createReferral({
        candidate: c,
        text: CLINIC_CASES[(i + 5) % CLINIC_CASES.length],
        referredToRole: "nurse",
        status: "dismissed",
        daysAgo,
      });
      await prisma.referral.update({
        where: { id: referral.id },
        data: { notes: "Reviewed — no clinic action needed after triage; adviser informed." },
      });
      await prisma.auditLog.create({
        data: {
          userId: nurse.id,
          actionType: "referral_dismissed",
          sourceTable: "referrals",
          sourceId: referral.id,
          reason: "Not a clinic matter after review — closed.",
          createdAt: at(-daysAgo + 1, 11),
        },
      });
      createdIds.push(referral.id);
      made++;
    }
    console.log(`clinic/dismissed (closed): +${made} (existing ${existing})`);
  }

  // ------------------------------------------------------------------ ADM --

  {
    // Awaiting the nurse's consultation review (form not started yet).
    const existing = await prisma.referral.count({
      where: {
        referredToRole: "adm_coordinator",
        consultReviewer: "nurse",
        status: "pending",
        referralFormReady: false,
      },
    });
    let made = 0;
    for (let i = 0; i < remain(existing); i++) {
      const c = nextCandidate();
      if (!c) break;
      const { referral } = await createReferral({
        candidate: c,
        text: ADM_CASES[i % ADM_CASES.length],
        referredToRole: "adm_coordinator",
        status: "pending",
        daysAgo: i % 7,
        consultReviewer: "nurse",
      });
      createdIds.push(referral.id);
      made++;
    }
    console.log(`adm/needs review: +${made} (existing ${existing})`);
  }

  {
    // Referral form (GCForm-03) completed — ready to forward.
    const existing = await prisma.referral.count({
      where: {
        referredToRole: "adm_coordinator",
        consultReviewer: "nurse",
        status: "pending",
        referralFormReady: true,
      },
    });
    let made = 0;
    for (let i = 0; i < remain(existing); i++) {
      const c = nextCandidate();
      if (!c) break;
      const { referral } = await createReferral({
        candidate: c,
        text: ADM_CASES[(i + 3) % ADM_CASES.length],
        referredToRole: "adm_coordinator",
        status: "pending",
        daysAgo: 1 + (i % 6),
        consultReviewer: "nurse",
      });
      await prisma.referral.update({
        where: { id: referral.id },
        data: {
          referralFormReady: true,
          notes:
            `[ADM endorsed] Recommended for ADM intake — health needs require a flexible schedule.` +
            ` | Concerns: Health, Attendance | Details: Recurring symptoms documented across clinic visits.` +
            ` | Actions taken: Vitals checked, guardian advised, clinic monitoring started.` +
            ` | Follow-up: Re-assess in two weeks.`,
        },
      });
      await prisma.auditLog.create({
        data: {
          userId: nurse.id,
          actionType: "referral_note_added",
          sourceTable: "referrals",
          sourceId: referral.id,
          reason: "ADM referral form completed — ready to forward",
          createdAt: at(-(1 + (i % 6)) + 1, 10),
        },
      });
      createdIds.push(referral.id);
      made++;
    }
    console.log(`adm/form ready (to forward): +${made} (existing ${existing})`);
  }

  {
    // Endorsed: consult reviewed, case now with the ADM coordinator.
    const existing = await prisma.referral.count({
      where: {
        referredToRole: "adm_coordinator",
        consultReviewer: "nurse",
        status: "in_progress",
      },
    });
    let made = 0;
    for (let i = 0; i < remain(existing); i++) {
      const c = nextCandidate();
      if (!c) break;
      const daysAgo = 3 + (i % 7);
      const { referral } = await createReferral({
        candidate: c,
        text: ADM_CASES[(i + 6) % ADM_CASES.length],
        referredToRole: "adm_coordinator",
        status: "pending",
        daysAgo,
        consultReviewer: "nurse",
      });
      await prisma.referral.update({
        where: { id: referral.id },
        data: {
          status: "in_progress",
          referralFormReady: true,
          consultReviewedAt: at(-daysAgo + 2, 9),
          notes:
            `[ADM consult] Endorsed for ADM — medical need verified, flexible schedule recommended.` +
            `\n[ADM referral] Concerns: Health, Attendance | Details: Condition limits regular class attendance.` +
            ` | Actions taken: Assessment done, guardian informed, clinic monitoring in place.`,
        },
      });
      await prisma.auditLog.create({
        data: {
          userId: nurse.id,
          actionType: "referral_status_change",
          sourceTable: "referrals",
          sourceId: referral.id,
          reason: "ADM consultation endorsed — forwarded to the coordinator",
          createdAt: at(-daysAgo + 2, 9),
        },
      });
      createdIds.push(referral.id);
      made++;
    }
    console.log(`adm/endorsed: +${made} (existing ${existing})`);
  }

  {
    // Rejected at consultation — closed by the nurse with a written reason.
    const existing = await prisma.referral.count({
      where: {
        referredToRole: "adm_coordinator",
        consultReviewer: "nurse",
        status: "dismissed",
      },
    });
    let made = 0;
    for (let i = 0; i < remain(existing); i++) {
      const c = nextCandidate();
      if (!c) break;
      const daysAgo = 4 + (i % 7);
      const { referral } = await createReferral({
        candidate: c,
        text: ADM_CASES[(i + 2) % ADM_CASES.length],
        referredToRole: "adm_coordinator",
        status: "pending",
        daysAgo,
        consultReviewer: "nurse",
      });
      await prisma.referral.update({
        where: { id: referral.id },
        data: {
          status: "dismissed",
          consultReviewedAt: at(-daysAgo + 2, 9),
          notes:
            "[ADM consult] Not endorsed — no medical basis for an ADM arrangement; regular attendance and clinic monitoring will cover the concern.",
        },
      });
      await prisma.auditLog.create({
        data: {
          userId: nurse.id,
          actionType: "referral_dismissed",
          sourceTable: "referrals",
          sourceId: referral.id,
          reason: "ADM consultation rejected — no medical basis for modular setup",
          createdAt: at(-daysAgo + 2, 9),
        },
      });
      createdIds.push(referral.id);
      made++;
    }
    console.log(`adm/rejected: +${made} (existing ${existing})`);
  }

  // --------------------------------------------------------- NOTIFICATIONS --
  {
    // The alerts page also lists the nurse's notification feed; fill it with
    // referral events until the same cap.
    const existing = await prisma.notification.count({
      where: { userId: nurse.id, sourceTable: "referrals" },
    });
    const samples: Array<[string, string, boolean]> = [
      [
        "referral_status_change",
        "A case was escalated to the clinic — needs assessment before guidance can continue.",
        false,
      ],
      ["referral_status_change", "You accepted a clinic referral — now in progress.", true],
      ["referral_status_change", "You completed a clinic session and set a follow-up.", true],
      ["referral_status_change", "You endorsed an ADM consultation — sent to the coordinator.", true],
      ["referral_status_change", "You requested more info on a clinic referral.", false],
      ["referral_status_change", "You marked a clinic referral resolved — case closed.", true],
      ["referral_status_change", "You completed the referral form — ready to forward.", true],
      ["referral_status_change", "You did not endorse an ADM referral — case closed.", true],
      ["referral_status_change", "You started handling a clinic referral.", true],
      ["referral_status_change", "New clinic referral on your desk — needs review.", false],
    ];
    let made = 0;
    for (let i = 0; i < remain(existing) && i < samples.length; i++) {
      const [type, message, isRead] = samples[i];
      const sourceId = createdIds[i * 7 % Math.max(1, createdIds.length)] ?? null;
      await prisma.notification.create({
        data: {
          userId: nurse.id,
          type,
          sourceTable: "referrals",
          sourceId,
          message,
          channel: ["web", "mobile", "email"],
          isRead,
          createdAt: at(-(i % 6), 8 + (i % 8)),
        },
      });
      made++;
    }
    console.log(`nurse notifications: +${made} (existing ${existing})`);
  }

  const scope = [
    { referredToRole: "nurse" as const },
    { status: "escalated" as const, escalatedTo: "nurse" },
    { referredToRole: "adm_coordinator" as const, consultReviewer: "nurse" },
  ];
  const total = await prisma.referral.count({
    where: { OR: scope, termId: term.id },
  });
  const sessions = await prisma.counselingSession.count({
    where: { referral: { OR: scope } },
  });
  console.log(
    `Done: nurse-visible referrals in term ${term.termNumber} = ${total}, clinic/ADM sessions = ${sessions}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
