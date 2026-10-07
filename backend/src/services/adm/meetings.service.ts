import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";
import { admMeetingObjectPath, getReferralBucket, uploadFile } from "../../lib/storage.js";
import type { AdmStage } from "../adm.js";
import {
  actorName,
  ensureAdmForm,
  formatMeetingAttachment,
  meetingInviteeInclude,
  meetingInviteeList,
} from "../../modules/adm/adm.repository.js";
import type { AdmContext } from "./adm.types.js";

// Parent/guardian meetings booked by the coordinator once a case is
// referred to ADM — in school ("school") or at home ("home", home
// visitation). Booking is allowed for any unsigned profile at a
// pre-certification stage; recording the outcome later drives the
// meeting_parents → certification | home_visitation branch.

// Roles the coordinator may invite to a parent meeting: specific people,
// never whole desks. subject_teacher is included because section advisers
// often log in under it — the staff directory only ever surfaces the
// case's own adviser, so this never opens whole-roster invites.
const INVITABLE_ROLES = ["nurse", "guidance_counselor", "adviser", "subject_teacher"] as const;

const PRE_CERT_STAGES: AdmStage[] = ["anecdotal", "consultation", "meeting_parents"];

/* Validate a booking-time invite list: deduped, actor excluded, every id an
   active invitable-role account. Returns the resolved people (id + name +
   role) for row creation and personalized notifications. Empty when omitted. */
async function resolveInvitees(
  actorId: string,
  raw: unknown,
): Promise<{ id: string; fullName: string; role: string }[]> {
  if (raw === undefined) return [];
  const ids = [
    ...new Set(
      (Array.isArray(raw) ? raw : []).filter(
        (v): v is string => typeof v === "string" && v.length > 0,
      ),
    ),
  ].filter((id) => id !== actorId);
  if (ids.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, status: "active" },
    select: { id: true, fullName: true, role: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return ids.map((id) => {
    const u = byId.get(id);
    if (!u)
      throw new AppError(
        400,
        "INVITEE_NOT_FOUND",
        "An invited person no longer has an active account",
      );
    if (!(INVITABLE_ROLES as readonly string[]).includes(u.role)) {
      throw new AppError(
        400,
        "INVITEE_ROLE",
        "Only guidance, nurse, adviser, and teacher staff can be invited",
      );
    }
    return { id: u.id, fullName: u.fullName, role: u.role };
  });
}

/* Persist one meeting's invitee set (booking creates; reschedule replaces).
   Names feed the audit trail. */
async function saveMeetingInvitees(
  meetingId: string,
  invitees: { id: string; fullName: string }[],
): Promise<void> {
  if (invitees.length === 0) return;
  await prisma.admMeetingInvitee.createMany({
    data: invitees.map((u) => ({ meetingId, userId: u.id })),
    skipDuplicates: true,
  });
}

function inviteeNames(invitees: { fullName: string }[]): string {
  return invitees.map((u) => u.fullName).join(", ");
}

export interface BookMeetingInput {
  meetingDatetime: string;
  venue: string;
  minutesOfMeeting?: string;
  attendanceLogbookRef?: string;
  inviteeIds?: string[];
}

export async function bookProfileMeeting(ctx: AdmContext, profileId: string, input: BookMeetingInput) {
  const profile = await prisma.admLearnerProfile.findUnique({
    where: { id: profileId },
    include: {
      student: { select: { user: { select: { fullName: true } } } },
      referral: { select: { id: true, referredBy: true, status: true, consultReviewer: true } },
    },
  });
  if (!profile) throw new AppError(404, "NOT_FOUND", "ADM profile not found");
  if (profile.referral?.status === "dismissed" || profile.referral?.status === "resolved") {
    throw new AppError(409, "REFERRAL_CLOSED", "This referral was cancelled/resolved — meetings can no longer be booked");
  }
  // Endorsement gate: a case still pending with its nurse/guidance
  // reviewer isn't the coordinator's yet — booking opens on endorse.
  if (
    profile.referral?.status === "pending" &&
    (profile.referral?.consultReviewer === "nurse" ||
      profile.referral?.consultReviewer === "guidance_counselor")
  ) {
    throw new AppError(409, "NOT_ENDORSED", "This case is still under consultation review — booking opens once it is endorsed to ADM");
  }
  if (profile.approvedBy || !PRE_CERT_STAGES.includes(profile.stage)) {
    throw new AppError(409, "MEETING_LOCKED", "Meetings can only be booked before certification");
  }
  // One booked meeting per case: a still-unattended meeting blocks a
  // second booking — reschedule it instead (PATCH
  // /api/adm/meetings/:meetingId/reschedule).
  const pendingMeeting = await prisma.admParentMeeting.count({
    where: { admLearnerProfileId: profile.id, attended: false },
  });
  if (pendingMeeting > 0) {
    throw new AppError(
      409,
      "MEETING_ALREADY_BOOKED",
      "This case already has a booked meeting — reschedule it instead of booking another one"
    );
  }
  // Invitees resolve before the write so a bad id fails the booking
  // with a 400 instead of leaving a meeting with no invites.
  const invitees = await resolveInvitees(ctx.userId, input.inviteeIds);
  const meeting = await prisma.admParentMeeting.create({
    data: {
      admLearnerProfileId: profile.id,
      recordedBy: ctx.userId,
      meetingDatetime: new Date(input.meetingDatetime),
      venue: input.venue,
      attended: false,
      minutesOfMeeting: input.minutesOfMeeting,
      attendanceLogbookRef: input.attendanceLogbookRef,
    },
  });
  await saveMeetingInvitees(meeting.id, invitees);
  await writeAudit({
    userId: ctx.userId,
    actionType: "adm_edit",
    sourceTable: "adm_parent_meetings",
    sourceId: meeting.id,
    reason: `Parent meeting booked (${input.venue === "home" ? "home visitation" : "in school"})${invitees.length > 0 ? ` · invited: ${inviteeNames(invitees)}` : ""}`,
  });
  // Realtime handoff (background, off the coordinator critical path):
  // the referring adviser sees a sileo toast on their current page the
  // moment this booking lands. fanoutNotification is best-effort and
  // never throws, so the coordinator's 201 is never delayed by it.
  {
    const studentName = profile.student?.user?.fullName ?? "your student";
    const when = meeting.meetingDatetime.toISOString().slice(0, 16).replace("T", " ");
    const venueLabel = input.venue === "home" ? "home visitation" : "in school";
    if (profile.referral && profile.referral.referredBy !== ctx.userId) {
      void fanoutNotification({
        userId: profile.referral.referredBy,
        sourceTable: "adm_parent_meetings",
        action: "book",
        message: `Parent meeting booked for ${studentName} on ${when} (${venueLabel}).`,
        sourceId: meeting.id,
      });
    }
    // Self row for the booking coordinator's own bell + badge. Phrased
    // "You …" so the desk echo guard swallows the realtime toast (the
    // local "Meeting booked" success already fired) while the row lands.
    void fanoutNotification({
      userId: ctx.userId,
      sourceTable: "adm_parent_meetings",
      action: "book_self",
      message: `You booked a parent meeting for ${studentName} on ${when} (${venueLabel}) — referrals.`,
      sourceId: meeting.id,
    });
  }
  // Invited staff learn they are wanted in the room — sileo + bell + badge.
  // The filing adviser already got their own booking message above.
  if (invitees.length > 0) {
    const actor = await actorName(ctx.userId);
    const studentName = profile.student?.user?.fullName ?? "your student";
    const when = meeting.meetingDatetime.toISOString().slice(0, 16).replace("T", " ");
    const venueLabel = input.venue === "home" ? "home visitation" : "in school";
    for (const inv of invitees) {
      if (inv.id === profile.referral?.referredBy) continue;
      void fanoutNotification({
        userId: inv.id,
        sourceTable: "adm_parent_meetings",
        action: "book",
        message: `${actor} invited you to a parent meeting for ${studentName} on ${when} (${venueLabel}).`,
        sourceId: meeting.id,
      });
    }
  }
  void fanoutToRole("adm_coordinator", {
    sourceTable: "adm_parent_meetings",
    action: "book",
    message: `Parent meeting booked for ${meeting.meetingDatetime.toISOString().slice(0, 16).replace("T", " ")}.`,
    sourceId: meeting.id,
    excludeUserId: ctx.userId,
  });
  return meeting;
}

// Pre-profile booking: schedule the parent meeting directly on a referral.
// Needs NO student account and NO learner profile — roster enlistments work.
// If a profile already exists for the referral, the meeting lands on it;
// otherwise it attaches to the referral and transfers on profile creation.
export async function bookReferralMeeting(ctx: AdmContext, referralId: string, input: BookMeetingInput) {
  const referral = await prisma.referral.findUnique({
    where: { id: referralId },
    include: {
      student: { select: { user: { select: { fullName: true } } } },
      roster: { select: { fullName: true } },
      admProfiles: { select: { id: true, approvedBy: true, stage: true } },
    },
  });
  if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
  if (referral.status === "dismissed" || referral.status === "resolved") {
    throw new AppError(409, "REFERRAL_CLOSED", "This referral was cancelled/resolved — meetings can no longer be booked");
  }
  if (referral.referredToRole !== "adm_coordinator") {
    throw new AppError(409, "NOT_ADM_CASE", "This referral is not routed to ADM");
  }
  // Endorsement gate: a case still pending with its nurse/guidance
  // reviewer isn't the coordinator's yet — booking opens on endorse.
  if (
    referral.status === "pending" &&
    (referral.consultReviewer === "nurse" ||
      referral.consultReviewer === "guidance_counselor")
  ) {
    throw new AppError(409, "NOT_ENDORSED", "This case is still under consultation review — booking opens once it is endorsed to ADM");
  }
  const profile = referral.admProfiles[0] ?? null;
  if (profile && (profile.approvedBy || !PRE_CERT_STAGES.includes(profile.stage as (typeof PRE_CERT_STAGES)[number]))) {
    throw new AppError(409, "MEETING_LOCKED", "Meetings can only be booked before certification");
  }
  // One booked meeting per case — a still-unattended meeting blocks a
  // second booking. Reschedule it instead (PATCH
  // /api/adm/meetings/:meetingId/reschedule).
  const pendingMeeting = await prisma.admParentMeeting.count({
    where: profile
      ? { admLearnerProfileId: profile.id, attended: false }
      : { referralId: referral.id, attended: false },
  });
  if (pendingMeeting > 0) {
    throw new AppError(
      409,
      "MEETING_ALREADY_BOOKED",
      "This case already has a booked meeting — reschedule it instead of booking another one"
    );
  }
  // Invitees resolve before the write so a bad id fails the booking
  // with a 400 instead of leaving a meeting with no invites.
  const invitees = await resolveInvitees(ctx.userId, input.inviteeIds);
  const meeting = await prisma.admParentMeeting.create({
    data: {
      admLearnerProfileId: profile ? profile.id : null,
      referralId: profile ? null : referral.id,
      recordedBy: ctx.userId,
      meetingDatetime: new Date(input.meetingDatetime),
      venue: input.venue,
      attended: false,
      minutesOfMeeting: input.minutesOfMeeting,
      attendanceLogbookRef: input.attendanceLogbookRef,
    },
  });
  await saveMeetingInvitees(meeting.id, invitees);
  await writeAudit({
    userId: ctx.userId,
    actionType: "adm_edit",
    sourceTable: "adm_parent_meetings",
    sourceId: meeting.id,
    reason: `Parent meeting booked (${input.venue === "home" ? "home visitation" : "in school"})${invitees.length > 0 ? ` · invited: ${inviteeNames(invitees)}` : ""}`,
  });
  // Realtime handoff (background, off the coordinator critical path):
  // the referring adviser sees a sileo toast on their current page the
  // moment this booking lands — naming the booking coordinator.
  // Best-effort — never delays the 201.
  const studentName =
    referral.student?.user?.fullName ?? referral.roster?.fullName ?? "your student";
  const when = meeting.meetingDatetime.toISOString().slice(0, 16).replace("T", " ");
  const venueLabel = input.venue === "home" ? "home visitation" : "in school";
  const actor = await actorName(ctx.userId);
  if (referral.referredBy !== ctx.userId) {
    const adviserId = referral.referredBy;
    void fanoutNotification({
      userId: adviserId,
      sourceTable: "adm_parent_meetings",
      action: "book",
      message: `${actor} booked a parent meeting for ${studentName} on ${when} (${venueLabel}).`,
      sourceId: meeting.id,
    });
  }
  // Self row for the booking coordinator's own bell + badge. Phrased
  // "You …" so the desk echo guard swallows the realtime toast (the
  // local "Meeting booked" success already fired) while the row lands.
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "adm_parent_meetings",
    action: "book",
    message: `You booked a parent meeting for ${studentName} on ${when} (${venueLabel}).`,
    sourceId: meeting.id,
  });
  // Invited staff learn they are wanted in the room — sileo + bell + badge.
  // The filing adviser already got their own booking message above.
  for (const inv of invitees) {
    if (inv.id === referral.referredBy) continue;
    void fanoutNotification({
      userId: inv.id,
      sourceTable: "adm_parent_meetings",
      action: "book",
      message: `${actor} invited you to a parent meeting for ${studentName} on ${when} (${venueLabel}).`,
      sourceId: meeting.id,
    });
  }
  void fanoutToRole("adm_coordinator", {
    sourceTable: "adm_parent_meetings",
    action: "book",
    message: `Parent meeting booked for ${meeting.meetingDatetime.toISOString().slice(0, 16).replace("T", " ")}.`,
    sourceId: meeting.id,
    excludeUserId: ctx.userId,
    messageFor: (r) =>
      `${actor} booked a parent meeting for ${studentName} on ${when} (${venueLabel}) — sent to you, ${r.fullName}.`,
  });
  return meeting;
}

export interface RescheduleMeetingInput {
  meetingDatetime: string;
  venue: string;
  attendanceLogbookRef?: string;
  inviteeIds?: string[];
}

// Reschedule a still-booked (unattended) parent meeting — new date/time
// and/or venue. Attended meetings keep their history and cannot move; book
// a fresh meeting instead. Locked (certified/signed) cases reject too.
export async function rescheduleMeeting(ctx: AdmContext, meetingId: string, input: RescheduleMeetingInput) {
  const meeting = await prisma.admParentMeeting.findUnique({
    where: { id: meetingId },
    include: {
      admLearnerProfile: {
        select: {
          id: true,
          approvedBy: true,
          stage: true,
          student: { select: { user: { select: { fullName: true } } } },
          referral: {
            select: {
              referredBy: true,
              status: true,
              consultReviewer: true,
              student: { select: { user: { select: { fullName: true } } } },
              roster: { select: { fullName: true } },
            },
          },
        },
      },
      referral: {
        select: {
          id: true,
          referredToRole: true,
          referredBy: true,
          status: true,
          consultReviewer: true,
          student: { select: { user: { select: { fullName: true } } } },
          roster: { select: { fullName: true } },
        },
      },
    },
  });
  if (!meeting) throw new AppError(404, "NOT_FOUND", "Meeting not found");
  if (
    (meeting.referral && (meeting.referral.status === "dismissed" || meeting.referral.status === "resolved")) ||
    (meeting.admLearnerProfile?.referral && (meeting.admLearnerProfile.referral.status === "dismissed" || meeting.admLearnerProfile.referral.status === "resolved"))
  ) {
    throw new AppError(409, "REFERRAL_CLOSED", "This referral was cancelled/resolved — meetings can no longer be rescheduled");
  }
  // Endorsement gate, same as booking: pending reviewer-owned cases
  // aren't the coordinator's yet.
  {
    const ref = meeting.referral ?? meeting.admLearnerProfile?.referral ?? null;
    if (
      ref?.status === "pending" &&
      (ref?.consultReviewer === "nurse" || ref?.consultReviewer === "guidance_counselor")
    ) {
      throw new AppError(409, "NOT_ENDORSED", "This case is still under consultation review — rescheduling opens once it is endorsed to ADM");
    }
  }
  if (meeting.attended) {
    throw new AppError(
      409,
      "MEETING_ATTENDED",
      "This meeting was already attended — book a new meeting instead of rescheduling it"
    );
  }
  if (
    meeting.admLearnerProfile &&
    (meeting.admLearnerProfile.approvedBy ||
      !PRE_CERT_STAGES.includes(meeting.admLearnerProfile.stage as (typeof PRE_CERT_STAGES)[number]))
  ) {
    throw new AppError(409, "MEETING_LOCKED", "Meetings can only be rescheduled before certification");
  }
  if (meeting.referral && meeting.referral.referredToRole !== "adm_coordinator") {
    throw new AppError(409, "NOT_ADM_CASE", "This referral is not routed to ADM");
  }
  const nextAt = new Date(input.meetingDatetime);
  if (Number.isNaN(nextAt.getTime()) || nextAt.getTime() <= Date.now()) {
    throw new AppError(400, "INVALID_DATE", "Pick a future date and time for the meeting");
  }
  // Invite-list edit rides along only when the coordinator sends it —
  // omitted keeps the current list untouched.
  const editInvitees = input.inviteeIds !== undefined;
  const nextInvitees = editInvitees
    ? await resolveInvitees(ctx.userId, input.inviteeIds)
    : null;
  const prevInviteeIds = editInvitees
    ? (
        await prisma.admMeetingInvitee.findMany({
          where: { meetingId: meeting.id },
          select: { userId: true },
        })
      ).map((r) => r.userId)
    : [];
  const updated = await prisma.admParentMeeting.update({
    where: { id: meeting.id },
    data: {
      meetingDatetime: nextAt,
      venue: input.venue,
      ...(typeof input.attendanceLogbookRef === "string" && input.attendanceLogbookRef.trim()
        ? { attendanceLogbookRef: input.attendanceLogbookRef.trim() }
        : {}),
    },
  });
  let addedInvitees: { id: string; fullName: string }[] = [];
  if (nextInvitees) {
    const nextIds = new Set(nextInvitees.map((u) => u.id));
    const prevIds = new Set(prevInviteeIds);
    const removed = [...prevIds].filter((id) => !nextIds.has(id));
    addedInvitees = nextInvitees.filter((u) => !prevIds.has(u.id));
    if (removed.length > 0) {
      await prisma.admMeetingInvitee.deleteMany({
        where: { meetingId: meeting.id, userId: { in: removed } },
      });
    }
    await saveMeetingInvitees(meeting.id, addedInvitees);
  }
  await writeAudit({
    userId: ctx.userId,
    actionType: "adm_edit",
    sourceTable: "adm_parent_meetings",
    sourceId: meeting.id,
    reason: `Parent meeting rescheduled to ${nextAt.toISOString().slice(0, 16).replace("T", " ")} (${input.venue === "home" ? "home visitation" : "in school"})${nextInvitees && addedInvitees.length > 0 ? ` · invited: ${inviteeNames(addedInvitees)}` : ""}`,
    oldValue: { meetingDatetime: meeting.meetingDatetime, venue: meeting.venue },
    newValue: { meetingDatetime: nextAt, venue: input.venue },
  });
  // The referring adviser learns the new schedule without refreshing —
  // naming the rescheduling coordinator.
  // (Book + outcome already fan out; reschedule previously stayed silent.)
  const actorId = ctx.userId;
  const adviserId =
    meeting.referral?.referredBy ??
    meeting.admLearnerProfile?.referral?.referredBy ??
    null;
  const studentName =
    meeting.referral?.student?.user?.fullName ??
    meeting.referral?.roster?.fullName ??
    meeting.admLearnerProfile?.student?.user?.fullName ??
    meeting.admLearnerProfile?.referral?.student?.user?.fullName ??
    meeting.admLearnerProfile?.referral?.roster?.fullName ??
    "your student";
  const when = nextAt.toISOString().slice(0, 16).replace("T", " ");
  const actor = await actorName(actorId);
  if (adviserId && adviserId !== actorId) {
    void fanoutNotification({
      userId: adviserId,
      sourceTable: "adm_parent_meetings",
      action: "reschedule",
      message: `${actor} moved the parent meeting for ${studentName} to ${when}.`,
      sourceId: meeting.id,
    });
  }
  // Self row for the rescheduling coordinator's own bell + badge. Phrased
  // "You …" so the desk echo guard swallows the realtime toast (the
  // local "Meeting rescheduled" success already fired) while the row lands.
  void fanoutNotification({
    userId: actorId,
    sourceTable: "adm_parent_meetings",
    action: "reschedule_self",
    message: `You moved the parent meeting for ${studentName} to ${when} — referrals.`,
    sourceId: meeting.id,
  });
  // Invitees follow the meeting: newly added staff get the invitation,
  // kept staff learn the new schedule. Removed staff go quiet.
  {
    const keptInvitees = nextInvitees
      ? nextInvitees.filter((u) => !addedInvitees.some((a) => a.id === u.id))
      : (
          await prisma.admMeetingInvitee.findMany({
            where: { meetingId: meeting.id },
            select: { user: { select: { fullName: true } }, userId: true },
          })
        ).map((r) => ({ id: r.userId, fullName: r.user.fullName }));
    const venueLabel = input.venue === "home" ? "home visitation" : "in school";
    for (const inv of addedInvitees) {
      if (inv.id === adviserId) continue;
      void fanoutNotification({
        userId: inv.id,
        sourceTable: "adm_parent_meetings",
        action: "reschedule",
        message: `${actor} invited you to a parent meeting for ${studentName} on ${when} (${venueLabel}).`,
        sourceId: meeting.id,
      });
    }
    for (const inv of keptInvitees) {
      if (inv.id === adviserId) continue;
      void fanoutNotification({
        userId: inv.id,
        sourceTable: "adm_parent_meetings",
        action: "reschedule",
        message: `${actor} moved the parent meeting for ${studentName} to ${when} (${venueLabel}).`,
        sourceId: meeting.id,
      });
    }
  }
  void fanoutToRole("adm_coordinator", {
    sourceTable: "adm_parent_meetings",
    action: "reschedule",
    message: `Parent meeting moved to ${nextAt.toISOString().slice(0, 16).replace("T", " ")}.`,
    sourceId: meeting.id,
    excludeUserId: actorId,
    messageFor: (r) =>
      `${actor} moved the parent meeting for ${studentName} to ${when} — sent to you, ${r.fullName}.`,
  });
  return updated;
}

export interface RecordOutcomeInput {
  attended: boolean;
  minutesOfMeeting?: string;
  attendanceLogbookRef?: string;
  parentConfirmedAt?: string;
  attendees?: { name: string; role: string; userId?: string }[];
}

export async function recordOutcome(ctx: AdmContext, meetingId: string, input: RecordOutcomeInput) {
  const meeting = await prisma.admParentMeeting.findUnique({
    where: { id: meetingId },
    include: {
      admLearnerProfile: {
        select: {
          id: true,
          approvedBy: true,
          student: { select: { user: { select: { fullName: true } } } },
          referral: {
            select: {
              referredBy: true,
              student: { select: { user: { select: { fullName: true } } } },
              roster: { select: { fullName: true } },
            },
          },
        },
      },
      referral: {
        select: {
          referredBy: true,
          status: true,
          student: { select: { user: { select: { fullName: true } } } },
          roster: { select: { fullName: true } },
        },
      },
    },
  });
  if (!meeting) throw new AppError(404, "NOT_FOUND", "Meeting not found");
  if (meeting.admLearnerProfile?.approvedBy) {
    throw new AppError(409, "MEETING_LOCKED", "Meetings can only be updated before certification");
  }
  const attended = input.attended;
  const updated = await prisma.admParentMeeting.update({
    where: { id: meeting.id },
    data: {
      attended,
      minutesOfMeeting: input.minutesOfMeeting,
      attendanceLogbookRef: input.attendanceLogbookRef,
      parentConfirmedAt: input.parentConfirmedAt ? new Date(input.parentConfirmedAt) : undefined,
      ...(input.attendees !== undefined ? { attendees: input.attendees } : {}),
    },
  });
  // An attended meeting materializes its minutes row (referral bookings
  // without a profile yet sync up when the profile is created).
  if (attended && meeting.admLearnerProfileId) {
    await ensureAdmForm(
      meeting.admLearnerProfileId,
      "MINUTES_OF_MEETING",
      "Minutes of meeting",
      ctx.userId,
    );
  }
  await writeAudit({
    userId: ctx.userId,
    actionType: "adm_edit",
    sourceTable: "adm_parent_meetings",
    sourceId: meeting.id,
    reason: attended ? "Parent meeting attended" : "Parents did not attend — home visitation path",
    oldValue: { attended: meeting.attended },
    newValue: { attended },
  });
  // Realtime handoff (background, off the coordinator critical path):
  // the referring adviser learns the meeting outcome without refreshing.
  // Best-effort — never delays the response.
  const actorId = ctx.userId;
  const adviserId =
    meeting.referral?.referredBy ??
    meeting.admLearnerProfile?.referral?.referredBy ??
    null;
  const studentName =
    meeting.referral?.student?.user?.fullName ??
    meeting.referral?.roster?.fullName ??
    meeting.admLearnerProfile?.student?.user?.fullName ??
    meeting.admLearnerProfile?.referral?.student?.user?.fullName ??
    meeting.admLearnerProfile?.referral?.roster?.fullName ??
    "your student";
  const actor = await actorName(actorId);
  if (adviserId && adviserId !== actorId) {
    void fanoutNotification({
      userId: adviserId,
      sourceTable: "adm_parent_meetings",
      action: "outcome",
      message: attended
        ? `${actor} recorded that parents attended the meeting for ${studentName}.`
        : `${actor} recorded that parents did not attend the meeting for ${studentName} — home visitation path applies.`,
      sourceId: meeting.id,
    });
  }
  void fanoutToRole("adm_coordinator", {
    sourceTable: "adm_parent_meetings",
    action: "outcome",
    message: attended
      ? `Parent meeting attended.`
      : `Parents did not attend — home visitation path applies.`,
    sourceId: meeting.id,
    excludeUserId: actorId,
    messageFor: (r) =>
      attended
        ? `${actor} recorded that parents attended the meeting for ${studentName} — sent to you, ${r.fullName}.`
        : `${actor} recorded that parents did not attend the meeting for ${studentName} — home visitation path applies — sent to you, ${r.fullName}.`,
  });
  void fanoutNotification({
    userId: actorId,
    sourceTable: "adm_parent_meetings",
    action: "outcome_self",
    message: attended
      ? `You recorded that parents attended the meeting for ${studentName} — referrals.`
      : `You recorded that parents did not attend the meeting for ${studentName} — referrals.`,
    sourceId: meeting.id,
  });
  return updated;
}

export async function listProfileMeetings(profileId: string) {
  const profile = await prisma.admLearnerProfile.findUnique({
    where: { id: profileId },
    select: { id: true },
  });
  if (!profile) throw new AppError(404, "NOT_FOUND", "ADM profile not found");
  const meetings = await prisma.admParentMeeting.findMany({
    where: { admLearnerProfileId: profile.id },
    include: {
      recorder: { select: { fullName: true } },
      ...meetingInviteeInclude,
      attachments: {
        select: {
          id: true,
          fileUrl: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
          uploadedAt: true,
        },
        orderBy: { uploadedAt: "asc" },
      },
    },
    orderBy: { meetingDatetime: "asc" },
  });
  return {
    meetings: meetings.map((m) => ({
      id: m.id,
      meetingDatetime: m.meetingDatetime.toISOString(),
      venue: m.venue,
      attended: m.attended,
      parentConfirmedAt: m.parentConfirmedAt ? m.parentConfirmedAt.toISOString() : null,
      minutesOfMeeting: m.minutesOfMeeting,
      attendanceLogbookRef: m.attendanceLogbookRef,
      attendees: m.attendees ?? [],
      invitees: meetingInviteeList(m),
      attachments: m.attachments.map(formatMeetingAttachment),
      recordedBy: m.recorder.fullName,
    })),
  };
}

// Meeting documentation (photos filed on a parent meeting: signed logbook,
// venue, agreements…). Documentation unlocks once the meeting time arrives
// (or after it was attended) — upcoming meetings reject new files. Closed
// referrals reject. Mirrors the clinic session documentation flow.
async function getDocumentableMeeting(meetingId: string) {
  const meeting = await prisma.admParentMeeting.findUnique({
    where: { id: meetingId },
    include: {
      referral: { select: { status: true } },
      admLearnerProfile: { select: { referral: { select: { status: true } } } },
    },
  });
  if (!meeting) throw new AppError(404, "NOT_FOUND", "Meeting not found");
  const status =
    meeting.referral?.status ??
    meeting.admLearnerProfile?.referral?.status ??
    null;
  if (status === "dismissed" || status === "resolved") {
    throw new AppError(400, "INVALID_ACTION", "Cannot add documentation to a closed case");
  }
  if (!meeting.attended && meeting.meetingDatetime.getTime() > Date.now()) {
    throw new AppError(
      400,
      "SESSION_NOT_STARTED",
      "This meeting hasn't started yet — documentation unlocks once the scheduled time arrives"
    );
  }
  return meeting;
}

export interface MeetingFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export async function addAttachments(ctx: AdmContext, meetingId: string, files: MeetingFile[]) {
  const meeting = await getDocumentableMeeting(meetingId);
  if (files.length === 0) {
    throw new AppError(400, "BAD_REQUEST", "Attach at least one image");
  }
  const existing = await prisma.admMeetingAttachment.count({
    where: { meetingId: meeting.id },
  });
  if (existing + files.length > 10) {
    throw new AppError(400, "BAD_REQUEST", "A meeting can hold at most 10 documentation images");
  }
  const created = [];
  for (const file of files) {
    const path = admMeetingObjectPath(meeting.id, file.originalname);
    const fileUrl = await uploadFile(file.buffer, path, file.mimetype, getReferralBucket());
    const row = await prisma.admMeetingAttachment.create({
      data: {
        meetingId: meeting.id,
        fileUrl,
        fileName: file.originalname.slice(0, 200),
        mimeType: file.mimetype,
        fileSize: file.size,
        uploadedBy: ctx.userId,
      },
    });
    created.push(row);
  }
  await writeAudit({
    userId: ctx.userId,
    actionType: "adm_edit",
    sourceTable: "adm_parent_meetings",
    sourceId: meeting.id,
    reason: `${created.length} documentation image${created.length === 1 ? "" : "s"} filed`,
    oldValue: null,
    newValue: { count: created.length },
  });
  return created.map(formatMeetingAttachment);
}

export async function removeAttachment(ctx: AdmContext, meetingId: string, attachmentId: string) {
  const meeting = await getDocumentableMeeting(meetingId);
  const row = await prisma.admMeetingAttachment.findUnique({
    where: { id: attachmentId },
  });
  if (!row || row.meetingId !== meeting.id) {
    throw new AppError(404, "NOT_FOUND", "Documentation not found");
  }
  await prisma.admMeetingAttachment.delete({ where: { id: row.id } });
  await writeAudit({
    userId: ctx.userId,
    actionType: "adm_edit",
    sourceTable: "adm_parent_meetings",
    sourceId: meeting.id,
    reason: `Documentation removed: ${row.fileName}`,
    oldValue: { fileName: row.fileName },
    newValue: null,
  });
  return { ok: true };
}
