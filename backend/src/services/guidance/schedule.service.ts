import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { INTERNAL_AGGREGATE_ROW_CAP } from "../../lib/pagination.js";
import {
  archivedAdvisoryLearnerIds,
  excludeArchivedSessionLearners,
  type ArchivedLearnerIds,
} from "../../lib/learnerVisibility.js";
import type { GuidanceContext } from "./guidance.types.js";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
/** A month grid can span six weeks; two months of padding is plenty. */
const MAX_RANGE_MS = 62 * 24 * 60 * 60 * 1000;

function toTimeKey(d: Date): string {
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Booked times for the current counselor on one UTC calendar day.
 * Counts `scheduled` counseling sessions on both pipelines that belong to
 * the counselor — sessions they created, or intervention follow-ups assigned
 * to them. Cancelled/completed sessions never block a slot.
 */
export async function getDaySchedule(ctx: GuidanceContext, dateKey: string) {
  if (!DATE_KEY.test(dateKey)) {
    throw new AppError(400, "INVALID_DATE", "Pick a valid date.");
  }
  const start = new Date(`${dateKey}T00:00:00.000Z`);
  const end = new Date(`${dateKey}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime())) {
    throw new AppError(400, "INVALID_DATE", "Pick a valid date.");
  }

  const termClauses: any[] = [];
  if (ctx.termId) {
    termClauses.push({
      OR: [{ referral: { termId: ctx.termId } }, { intervention: { termId: ctx.termId } }],
    });
  }

  const archivedLearners = await archivedAdvisoryLearnerIds();
  const rows = await prisma.counselingSession.findMany({
    where: {
      AND: [
        { status: "scheduled" },
        { scheduledAt: { gte: start, lte: end } },
        {
          OR: [{ createdBy: ctx.userId }, { intervention: { assignedTo: ctx.userId } }],
        },
        ...termClauses,
        // A learner the adviser deleted no longer blocks a slot.
        excludeArchivedSessionLearners(archivedLearners),
      ],
    },
    select: { scheduledAt: true },
  });

  const taken = [...new Set(rows.map((r) => toTimeKey(r.scheduledAt)))].sort();
  return { date: dateKey, taken };
}

/** What an event on the guidance calendar is. */
export type GuidanceCalendarTrack =
  | "intervention"
  | "counseling"
  | "adm"
  | "adm_meeting";

export interface GuidanceCalendarEvent {
  id: string;
  track: GuidanceCalendarTrack;
  learner: string;
  lrn: string;
  section: string;
  sessionType: string;
  /** ISO instant — the client renders it in the browser's local time. */
  start: string;
  venue: string;
  status: string;
  outcome: string;
  referralId: string | null;
  interventionId: string | null;
  admProfileId: string | null;
  /** Parent meetings only: is this counselor one of the booking's invitees? */
  invited: boolean | null;
}

export interface GuidanceCalendarQuery {
  /** ISO instant, inclusive. */
  from: string;
  /** ISO instant, inclusive. */
  to: string;
  /** "all" keeps completed/cancelled sessions and attended meetings. */
  status: "all" | "scheduled";
}

export interface GuidanceCalendarData {
  range: { from: string; to: string };
  status: GuidanceCalendarQuery["status"];
  counts: Record<GuidanceCalendarTrack, number>;
  events: GuidanceCalendarEvent[];
}

const STUDENT_SELECT = {
  lrn: true,
  user: { select: { fullName: true } },
  section: { select: { name: true } },
} as const;

const ROSTER_SELECT = {
  lrn: true,
  fullName: true,
  section: { select: { name: true } },
} as const;

type LearnerHolder = {
  student?: { lrn: string; user: { fullName: string } | null; section: { name: string } | null } | null;
  roster?: { lrn: string; fullName: string; section: { name: string } | null } | null;
};

/**
 * Learners an adviser removed from their advisory list are hidden from every
 * desk board — the calendar must honour that too, or a deleted learner keeps
 * showing up as if they were still enrolled.
 *
 * Sessions ride either a referral (adviser-referred case) or an intervention
 * (risk follow-up); meetings ride a referral or an ADM learner profile. The
 * branch list is flattened so `NOT: { OR: [...] }` covers every pipeline.
 */
function excludeArchivedLearners(
  ids: ArchivedLearnerIds,
  holders: ("referral" | "intervention" | "admLearnerProfile")[],
): { NOT?: any } {
  const branches: any[] = [];
  for (const holder of holders) {
    if (ids.studentIds.length > 0) {
      branches.push({ [holder]: { studentId: { in: ids.studentIds } } });
    }
    if (ids.rosterIds.length > 0 && holder !== "admLearnerProfile") {
      branches.push({ [holder]: { rosterId: { in: ids.rosterIds } } });
    }
  }
  return branches.length > 0 ? { NOT: { OR: branches } } : {};
}

function learnerOf(holder: LearnerHolder | null | undefined) {
  return {
    learner: holder?.student?.user?.fullName ?? holder?.roster?.fullName ?? "Unknown learner",
    lrn: holder?.student?.lrn ?? holder?.roster?.lrn ?? "",
    section: holder?.student?.section?.name ?? holder?.roster?.section?.name ?? "",
  };
}

/**
 * Everything the guidance desk has booked in one date window: counseling
 * sessions on the referral pipelines (counseling + ADM) and on intervention
 * follow-ups, plus ADM parent meetings (school or home) the desk oversees.
 *
 * The window is sent as ISO instants so the browser's local month/week
 * boundary is respected; the desk stays term-scoped server-side like every
 * other guidance read.
 */
export async function getCalendar(
  ctx: GuidanceContext,
  query: GuidanceCalendarQuery,
): Promise<GuidanceCalendarData> {
  const from = new Date(query.from);
  const to = new Date(query.to);
  if (
    !query.from ||
    !query.to ||
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime())
  ) {
    throw new AppError(400, "INVALID_RANGE", "Pick a valid date range.");
  }
  if (from.getTime() > to.getTime()) {
    throw new AppError(400, "INVALID_RANGE", "The range ends before it starts.");
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
    throw new AppError(400, "INVALID_RANGE", "Pick a range of at most two months.");
  }

  const scheduledOnly = query.status !== "all";
  const archived = await archivedAdvisoryLearnerIds();
  const deskScope = {
    OR: [
      { referredToRole: "guidance_counselor" as const },
      {
        referredToRole: "adm_coordinator" as const,
        OR: [{ consultReviewer: null }, { consultReviewer: "guidance_counselor" }],
      },
    ],
  };
  const sessionWhere: any = {
    AND: [
      { scheduledAt: { gte: from, lte: to } },
      ...(scheduledOnly ? [{ status: "scheduled" }] : []),
      ...(ctx.termId
        ? [
            {
              OR: [
                { referral: { termId: ctx.termId } },
                { intervention: { termId: ctx.termId } },
              ],
            },
          ]
        : []),
      {
        OR: [
          { interventionId: { not: null } },
          { referral: { OR: deskScope.OR } },
        ],
      },
      excludeArchivedLearners(archived, ["referral", "intervention"]),
    ],
  };

  const meetingWhere: any = {
    AND: [
      { meetingDatetime: { gte: from, lte: to } },
      ...(scheduledOnly ? [{ attended: false }] : []),
      ...(ctx.termId
        ? [
            {
              OR: [
                { referral: { termId: ctx.termId } },
                { admLearnerProfile: { termId: ctx.termId } },
              ],
            },
          ]
        : []),
      {
        OR: [
          { referral: { OR: deskScope.OR } },
          { admLearnerProfile: { referral: { OR: deskScope.OR } } },
        ],
      },
      excludeArchivedLearners(archived, ["referral", "admLearnerProfile"]),
    ],
  };

  const [sessions, meetings] = await Promise.all([
    prisma.counselingSession.findMany({
      where: sessionWhere,
      orderBy: { scheduledAt: "asc" },
      take: INTERNAL_AGGREGATE_ROW_CAP,
      select: {
        id: true,
        sessionType: true,
        scheduledAt: true,
        venue: true,
        status: true,
        outcome: true,
        referral: {
          select: {
            id: true,
            referredToRole: true,
            escalatedTo: true,
            student: { select: STUDENT_SELECT },
            roster: { select: ROSTER_SELECT },
          },
        },
        intervention: {
          select: {
            id: true,
            student: { select: STUDENT_SELECT },
            roster: { select: ROSTER_SELECT },
          },
        },
      },
    }),
    prisma.admParentMeeting.findMany({
      where: meetingWhere,
      orderBy: { meetingDatetime: "asc" },
      take: INTERNAL_AGGREGATE_ROW_CAP,
      select: {
        id: true,
        meetingDatetime: true,
        venue: true,
        attended: true,
        referral: {
          select: {
            id: true,
            student: { select: STUDENT_SELECT },
            roster: { select: ROSTER_SELECT },
          },
        },
        admLearnerProfile: {
          select: {
            id: true,
            student: { select: STUDENT_SELECT },
            // Profile-side bookings carry the case's referral here, so the
            // calendar can still deep-link to the ADM case desk.
            referral: { select: { id: true } },
          },
        },
        invitees: { select: { userId: true } },
      },
    }),
  ]);

  const events: GuidanceCalendarEvent[] = [];

  for (const s of sessions) {
    if (s.intervention) {
      events.push({
        id: `session:${s.id}`,
        track: "intervention",
        ...learnerOf(s.intervention),
        sessionType: s.sessionType,
        start: s.scheduledAt.toISOString(),
        venue: s.venue ?? "",
        status: s.status,
        outcome: s.outcome ?? "",
        referralId: null,
        interventionId: s.intervention.id,
        admProfileId: null,
        invited: null,
      });
      continue;
    }
    if (!s.referral) continue;
    const adm =
      s.referral.referredToRole === "adm_coordinator" ||
      s.referral.escalatedTo === "adm_coordinator";
    events.push({
      id: `session:${s.id}`,
      track: adm ? "adm" : "counseling",
      ...learnerOf(s.referral),
      sessionType: s.sessionType,
      start: s.scheduledAt.toISOString(),
      venue: s.venue ?? "",
      status: s.status,
      outcome: s.outcome ?? "",
      referralId: s.referral.id,
      interventionId: null,
      admProfileId: null,
      invited: null,
    });
  }

  for (const m of meetings) {
    const holder = m.referral ?? m.admLearnerProfile;
    if (!holder) continue;
    events.push({
      id: `meeting:${m.id}`,
      track: "adm_meeting",
      ...learnerOf(holder),
      // "school" | "home" — the interface shows home visitations differently.
      sessionType: "parent_conference",
      start: m.meetingDatetime.toISOString(),
      venue: m.venue ?? "",
      status: m.attended ? "completed" : "scheduled",
      outcome: "",
      referralId: m.referral?.id ?? m.admLearnerProfile?.referral?.id ?? null,
      interventionId: null,
      admProfileId: m.admLearnerProfile?.id ?? null,
      invited: m.invitees.some((i) => i.userId === ctx.userId),
    });
  }

  events.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

  const counts: Record<GuidanceCalendarTrack, number> = {
    intervention: 0,
    counseling: 0,
    adm: 0,
    adm_meeting: 0,
  };
  for (const event of events) counts[event.track] += 1;

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    status: query.status,
    counts,
    events,
  };
}
