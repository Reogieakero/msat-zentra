import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

// Seeds the guidance Session Documents page with completed counseling sessions
// and filed images. Images are copied into frontend/public/session-docs and
// referenced by their public URL, so no Supabase upload is needed.
//
// Run from backend:  npx tsx prisma/seed-guidance-session-docs.ts
// Optional:          SEED_COUNT=12 npx tsx prisma/seed-guidance-session-docs.ts

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

const SEED_MARKER = "[guidance-session-docs seed]";
const TARGET = Math.max(1, Number(process.env.SEED_COUNT) || 9);

function at(daysFromToday: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const SESSION_IMAGES = [
  { name: "session-notes-2026-10-14.jpg", mimeType: "image/jpeg" },
  { name: "session-notes-2026-10-15.png", mimeType: "image/png" },
  { name: "session-notes-2026-10-16.jpg", mimeType: "image/jpeg" },
  { name: "referral-form-2026-10-18.png", mimeType: "image/png" },
  { name: "referral-form-template.png", mimeType: "image/png" },
];

const publicDir = path.resolve(process.cwd(), "../frontend/public/session-docs");
if (!fs.existsSync(publicDir)) {
  throw new Error(
    `Session-doc images not found at ${publicDir}. Copy images into frontend/public/session-docs first.`,
  );
}
const images = SESSION_IMAGES.map((image) => {
  const filePath = path.join(publicDir, image.name);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing session-doc image: ${filePath}`);
  }
  return {
    ...image,
    fileSize: fs.statSync(filePath).size,
    fileUrl: `/session-docs/${image.name}`,
  };
});

type Track = "Counseling" | "ADM";
type Status = "in_progress" | "follow_up" | "resolved";

interface SeedCase {
  track: Track;
  status: Status;
  category: "behavioral" | "bullying" | "academic" | "attendance" | "health";
  incident: string;
  location: string;
  notes: string;
  classPerformance: string;
  attendanceSummary: string;
  reason: string;
  sessions: {
    type: "individual" | "parent_conference" | "group" | "home_visit";
    daysAgo: number;
    notes: string;
    outcome: string;
    images: number[];
  }[];
}

const CASES: SeedCase[] = [
  {
    track: "Counseling",
    status: "resolved",
    category: "bullying",
    incident:
      "Student reported that two classmates repeatedly hid their bag and called them names during recess; cried while recounting the latest incident.",
    location: "Playground",
    notes: "Counseling intake completed; coping plan agreed with the student.",
    classPerformance: "Previously active; now quiet and avoids group work.",
    attendanceSummary: "Present daily; asked to go home early once.",
    reason: "Reported peer bullying at recess — resolved after counseling sessions.",
    sessions: [
      {
        type: "individual",
        daysAgo: 9,
        notes: "First counseling session. Student described the recurring teasing and agreed to report incidents to the adviser.",
        outcome: "Student felt heard; safety plan started.",
        images: [0, 3],
      },
      {
        type: "parent_conference",
        daysAgo: 4,
        notes: "Met with the guardian to align on reporting and classroom seating adjustments.",
        outcome: "Guardian agreed to coordinate with the adviser.",
        images: [1, 4],
      },
    ],
  },
  {
    track: "Counseling",
    status: "in_progress",
    category: "behavioral",
    incident:
      "Student slammed their chair and shouted at a seatmate after losing a classroom game; refused to apologize and left the room.",
    location: "Classroom",
    notes: "Anger-management counseling recommended; loop in parents if repeated.",
    classPerformance: "Average; incidents cluster around competitive activities.",
    attendanceSummary: "No absences this term.",
    reason: "Outburst after a classroom game — ongoing self-control counseling.",
    sessions: [
      {
        type: "individual",
        daysAgo: 6,
        notes: "Explored triggers around losing and being teased. Practiced a pause-and-breathe routine.",
        outcome: "Student can name two triggers and one calming step.",
        images: [2],
      },
      {
        type: "group",
        daysAgo: 2,
        notes: "Small-group session on handling frustration during games.",
        outcome: "Student participated and apologized to the seatmate.",
        images: [0, 1],
      },
    ],
  },
  {
    track: "Counseling",
    status: "follow_up",
    category: "academic",
    incident:
      "Student failed all three quizzes this week and told the teacher they have 'given up' because lessons move too fast to follow.",
    location: "Classroom",
    notes: "Study-habit counseling plus remediation plan with subject teachers.",
    classPerformance: "Failing quizzes; outputs submitted but incomplete.",
    attendanceSummary: "Present daily.",
    reason: "Giving up on lessons moving too fast — study counseling with follow-up.",
    sessions: [
      {
        type: "individual",
        daysAgo: 7,
        notes: "Mapped the student's study routine and identified late-night phone use as a barrier.",
        outcome: "Agreed on a fixed study block and weekly check-in.",
        images: [3],
      },
      {
        type: "parent_conference",
        daysAgo: 3,
        notes: "Guardian joined to set a device curfew and review the remediation plan.",
        outcome: "Plan in place; needs one more follow-up.",
        images: [4, 0],
      },
    ],
  },
  {
    track: "Counseling",
    status: "in_progress",
    category: "attendance",
    incident:
      "Student has been late six times in two weeks, each time saying they overslept after late-night mobile gaming.",
    location: "School gate",
    notes: "Habit counseling; agree on a device curfew with parents.",
    classPerformance: "Satisfactory when present for full periods.",
    attendanceSummary: "6 tardy marks in two weeks.",
    reason: "Chronic tardiness from late-night gaming — habit counseling in progress.",
    sessions: [
      {
        type: "individual",
        daysAgo: 5,
        notes: "Student traced the late nights to gaming with cousins and agreed to try a 10 p.m. cut-off.",
        outcome: "Two consecutive on-time arrivals reported.",
        images: [1],
      },
    ],
  },
  {
    track: "Counseling",
    status: "resolved",
    category: "health",
    incident:
      "Student disclosed frequent stomach pain every school morning and has vomited twice this week before first period.",
    location: "Classroom",
    notes: "Medical workup coordinated with the nurse; counseling on school-related anxiety.",
    classPerformance: "Missing first-period outputs regularly.",
    attendanceSummary: "Present but ill most mornings.",
    reason: "Recurring morning stomach pain — counseling and clinic coordination completed.",
    sessions: [
      {
        type: "individual",
        daysAgo: 12,
        notes: "Explored morning anxiety and classroom pressure; practiced grounding exercises.",
        outcome: "Student identified worry about recitation as a trigger.",
        images: [2, 1],
      },
      {
        type: "home_visit",
        daysAgo: 6,
        notes: "Home visit with the guardian to review morning routines and clinic advice.",
        outcome: "Routine adjusted; symptoms reduced.",
        images: [3],
      },
    ],
  },
  {
    track: "Counseling",
    status: "in_progress",
    category: "bullying",
    incident:
      "Student was excluded from a group chat and shown screenshots mocking their answers in class.",
    location: "Classroom / Online",
    notes: "Cyberbullying response; document evidence and coordinate with the adviser.",
    classPerformance: "Participation dropped; still submits written work.",
    attendanceSummary: "Present daily.",
    reason: "Online exclusion and mocking — counseling and documentation ongoing.",
    sessions: [
      {
        type: "individual",
        daysAgo: 4,
        notes: "Reviewed screenshots and discussed blocking/reporting steps.",
        outcome: "Student reported the group chat to the guardian.",
        images: [4, 2],
      },
    ],
  },
  {
    track: "ADM",
    status: "resolved",
    category: "attendance",
    incident:
      "Student has missed 12 class days this month without excuse letters; parents could not be reached by phone after three attempts.",
    location: "Classroom",
    notes: "ADM consultation recommended; modular learning considered while absences were reviewed.",
    classPerformance: "Failing two subjects due to missed lessons and outputs.",
    attendanceSummary: "12 absences, 4 tardy marks this month.",
    reason: "ADM consultation — chronic absenteeism; resolved after parent conference.",
    sessions: [
      {
        type: "individual",
        daysAgo: 10,
        notes: "Discussed barriers to attendance and the possibility of temporary modular work.",
        outcome: "Student agreed to a two-week attendance contract.",
        images: [0, 4],
      },
      {
        type: "parent_conference",
        daysAgo: 3,
        notes: "Met with the guardian and ADM coordinator to finalize the support plan.",
        outcome: "Attendance improved; case resolved.",
        images: [3],
      },
    ],
  },
  {
    track: "ADM",
    status: "in_progress",
    category: "academic",
    incident:
      "Student's grades fell from passing to failing in three subjects within one quarter; teacher notes the student stopped submitting modules entirely.",
    location: "Classroom",
    notes: "ADM consultation: assess whether home-based modules fit better than daily attendance.",
    classPerformance: "Failing Math, Science, and English this quarter.",
    attendanceSummary: "Present but unproductive; 2 absences.",
    reason: "ADM consultation — sharp academic decline; endorsed to the coordinator.",
    sessions: [
      {
        type: "individual",
        daysAgo: 8,
        notes: "Reviewed the student's workload and identified difficulty keeping up with module deadlines.",
        outcome: "Temporary module plan drafted.",
        images: [1],
      },
      {
        type: "group",
        daysAgo: 1,
        notes: "Joined the subject teachers and coordinator to align on the module plan.",
        outcome: "Plan endorsed; monitoring continues.",
        images: [2, 0],
      },
    ],
  },
  {
    track: "ADM",
    status: "resolved",
    category: "behavioral",
    incident:
      "Student figured in three separate classroom disruptions this week, including walking out mid-lesson twice after disagreement with seatmates.",
    location: "Classroom",
    notes: "ADM consultation: structured setup with fewer triggers may help; review with parents present.",
    classPerformance: "Outputs incomplete; capable when focused one-on-one.",
    attendanceSummary: "Present daily; 1 guidance visit logged.",
    reason: "ADM consultation — repeated classroom disruptions; resolved with a support plan.",
    sessions: [
      {
        type: "individual",
        daysAgo: 11,
        notes: "Identified crowded transitions as a trigger and practiced requesting a break.",
        outcome: "Student used the break routine twice this week.",
        images: [4, 1],
      },
      {
        type: "parent_conference",
        daysAgo: 5,
        notes: "Reviewed progress with the guardian and agreed to continue the support plan.",
        outcome: "No further walkouts reported.",
        images: [3],
      },
    ],
  },
];

async function main() {
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
      (t) =>
        day(t.startDate, "0000-01-01") <= today &&
        today <= day(t.endDate, "9999-12-31"),
    ) ?? year.terms[0];
  if (!term) throw new Error("No term in the active school year");

  const counselor = await prisma.user.findFirst({
    where: { role: "guidance_counselor", status: "active" },
  });
  if (!counselor) throw new Error("No active guidance_counselor user");

  const fallbackAdviser = await prisma.user.findFirst({
    where: { role: { in: ["adviser", "subject_teacher"] }, status: "active" },
    select: { id: true, fullName: true },
  });
  if (!fallbackAdviser) throw new Error("No adviser/subject teacher found");

  const existing = await prisma.referral.count({
    where: {
      termId: term.id,
      referredToRole: "guidance_counselor",
      reason: { startsWith: SEED_MARKER },
    },
  });
  if (existing >= TARGET) {
    console.log(
      `Already seeded: ${existing} guidance session-doc cases in term ${term.termNumber}. Nothing to do.`,
    );
    return;
  }

  const rosters = await prisma.studentRoster.findMany({
    where: {
      schoolYearId: year.id,
      NOT: { sectionId: { startsWith: "xxxx" } },
    },
    include: { section: { select: { id: true, name: true, adviserId: true } } },
    orderBy: { lrn: "desc" },
  });
  const taken = new Set(
    (
      await prisma.referral.findMany({
        where: { termId: term.id },
        select: { rosterId: true },
      })
    )
      .map((r) => r.rosterId)
      .filter((id): id is string => !!id),
  );
  const candidates = rosters.filter(
    (r) => !taken.has(r.id) && !r.sectionId.startsWith("xxxx"),
  );
  if (candidates.length === 0) {
    throw new Error("No roster students left without a referral");
  }

  let created = 0;
  let imageCursor = 0;

  for (let i = existing; i < TARGET; i++) {
    const seed = CASES[i % CASES.length];
    const target = candidates[created];
    if (!target) break;

    const observerId = target.section.adviserId ?? fallbackAdviser.id;
    const observedAt = at(-(10 + (i % 12)), 8, 30);

    const anecdotal = await prisma.anecdotalRecord.create({
      data: {
        rosterId: target.id,
        studentId: null,
        observerId,
        sectionId: target.sectionId,
        observationDatetime: observedAt,
        descriptionOfIncident: seed.incident,
        descriptionOfLocation: seed.location,
        notesRecommendationsActions: seed.notes,
        classPerformance: seed.classPerformance,
        attendanceSummary: seed.attendanceSummary,
        category: seed.category,
        confidentialityLevel: "restricted",
        termId: term.id,
      },
    });

    const referral = await prisma.referral.create({
      data: {
        anecdotalRecordId: anecdotal.id,
        referredToRole: "guidance_counselor",
        referredBy: observerId,
        reason: `${SEED_MARKER} ${seed.reason}`,
        status: seed.status,
        escalatedTo: seed.track === "ADM" ? "adm_coordinator" : null,
        consultReviewer: null,
        referralFormReady: seed.track === "ADM",
        rosterId: target.id,
        studentId: null,
        termId: term.id,
        acceptedAt: at(-(9 + (i % 10)), 9, 0),
        intakeNotes: "Accepted for counseling; session documentation filed.",
        resolutionSummary:
          seed.status === "resolved"
            ? "Support plan completed and case closed after documented counseling sessions."
            : null,
        resolvedAt: seed.status === "resolved" ? at(-(2 + (i % 4)), 15, 0) : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: observerId,
        actionType: "referral_status_change",
        sourceTable: "referrals",
        sourceId: referral.id,
        reason:
          seed.track === "ADM"
            ? "Referred to guidance_counselor (ADM track)"
            : "Referred to guidance_counselor",
        createdAt: observedAt,
      },
    });

    for (const [sessionIndex, sessionSpec] of seed.sessions.entries()) {
      const scheduledAt = at(-sessionSpec.daysAgo, 9 + sessionIndex, 0);
      const completedAt = new Date(scheduledAt.getTime() + 45 * 60_000);

      const session = await prisma.counselingSession.create({
        data: {
          referralId: referral.id,
          sessionType: sessionSpec.type,
          scheduledAt,
          venue:
            sessionSpec.type === "home_visit"
              ? "Student's home"
              : "Guidance office",
          status: "completed",
          sessionNotes: sessionSpec.notes,
          outcome: sessionSpec.outcome,
          createdBy: counselor.id,
          completedAt,
        },
      });

      for (const imageIndex of sessionSpec.images) {
        const image = images[imageCursor % images.length];
        imageCursor++;
        await prisma.clinicSessionAttachment.create({
          data: {
            sessionId: session.id,
            fileUrl: image.fileUrl,
            fileName: `${target.fullName.replace(/\s+/g, "-")}-${sessionSpec.type}-${image.name}`,
            mimeType: image.mimeType,
            fileSize: image.fileSize,
            uploadedBy: counselor.id,
            uploadedAt: new Date(completedAt.getTime() + 5 * 60_000),
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          userId: counselor.id,
          actionType: "session_completed",
          sourceTable: "counseling_sessions",
          sourceId: session.id,
          reason: "Guidance session completed with filed documentation",
          createdAt: completedAt,
        },
      });
    }

    console.log(
      `OK ${target.lrn ?? target.id} (${target.fullName} / ${target.section.name}): ` +
        `${seed.track} ${seed.status} — ${seed.sessions.length} session(s)`,
    );
    created++;
  }

  const total = await prisma.referral.count({
    where: {
      termId: term.id,
      referredToRole: "guidance_counselor",
      reason: { startsWith: SEED_MARKER },
    },
  });
  console.log(
    `Done: created ${created} new case(s); ${total} seeded session-doc case(s) in term ${term.termNumber}.`,
  );
  console.log(
    `Images served from /session-docs (${images.length} files, updated ${new Date().toISOString()}).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
