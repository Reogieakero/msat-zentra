import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { INTERNAL_AGGREGATE_ROW_CAP } from "../../lib/pagination.js";
import {
  archivedAdvisoryLearnerIds,
  type ArchivedLearnerIds,
} from "../../lib/learnerVisibility.js";

/** A month grid can span six weeks; two months of padding is plenty. */
const MAX_RANGE_MS = 62 * 24 * 60 * 60 * 1000;

export interface NurseCalendarContext {
  userId: string;
  termId: string | null;
}

/** What an event on the nurse calendar is. */
export type NurseCalendarTrack = "clinic" | "adm" | "adm_meeting";

export interface NurseCalendarEvent {
  id: string;
  track: NurseCalendarTrack;
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
  /** Parent meetings only: is this nurse one of the booking's invitees? */
  invited: boolean | null;
}

export interface NurseCalendarQuery {
  from: string;
  to: string;
  status: "all" | "scheduled";
}

export interface NurseCalendarData {
  range: { from: string; to: string };
  status: NurseCalendarQuery["status"];
  counts: Record<NurseCalendarTrack, number>;
  events: NurseCalendarEvent[];
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

/** The nurse desk scope, mirrored from `listQueue` in `queues.desk.service.ts`. */
const NURSE_REFERRAL_SCOPE = {
  OR: [
    { referredToRole: "nurse" as const },
    { status: "escalated" as const, escalatedTo: "nurse" },
    { referredToRole: "adm_coordinator" as const, consultReviewer: "nurse" },
  ],
} as const;

/**
 * Learners an adviser removed from their advisory list are hidden from every
 * desk board; the nurse calendar honours the same archive filter.
 */
function excludeArchivedLearners(
  ids: ArchivedLearnerIds,
  holders: ("referral" | "admLearnerProfile")[],
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
 * Everything the clinic desk has booked in one date window: counseling
 * sessions on referrals on the nurse desk (clinic matters and the ADM
 * consultations the nurse reviews) plus ADM parent meetings the nurse is
 * invited to or that belong to a case on the nurse desk.
 *
 * The window is sent as ISO instants so the browser's local month/week
 * boundary is respected; the desk stays term-scoped server-side like every
 * other nurse read.
 */
export async function getNurseCalendar(
  ctx: NurseCalendarContext,
  query: NurseCalendarQuery,
): Promise<NurseCalendarData> {
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

  const sessionWhere: any = {
    AND: [
      { scheduledAt: { gte: from, lte: to } },
      ...(scheduledOnly ? [{ status: "scheduled" }] : []),
      ...(ctx.termId ? [{ referral: { termId: ctx.termId } }] : []),
      { referral: { OR: NURSE_REFERRAL_SCOPE.OR } },
      excludeArchivedLearners(archived, ["referral"]),
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
          { referral: { OR: NURSE_REFERRAL_SCOPE.OR } },
          { admLearnerProfile: { referral: { OR: NURSE_REFERRAL_SCOPE.OR } } },
          { invitees: { some: { userId: ctx.userId } } },
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
            referral: { select: { id: true } },
          },
        },
        invitees: { select: { userId: true } },
      },
    }),
  ]);

  const events: NurseCalendarEvent[] = [];

  for (const s of sessions) {
    if (!s.referral) continue;
    const adm =
      s.referral.referredToRole === "adm_coordinator" ||
      s.referral.escalatedTo === "adm_coordinator";
    events.push({
      id: `session:${s.id}`,
      track: adm ? "adm" : "clinic",
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

  const counts: Record<NurseCalendarTrack, number> = {
    clinic: 0,
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
