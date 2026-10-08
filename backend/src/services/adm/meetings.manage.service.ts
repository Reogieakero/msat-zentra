import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";
import { actorName, ensureAdmForm, formatMeetingAttachment, meetingInviteeInclude, meetingInviteeList } from "../../modules/adm/adm.repository.js";
import { inviteeNames, PRE_CERT_STAGES, resolveInvitees, saveMeetingInvitees } from "./meetings.booking.service.js";
import type { AdmContext } from "./adm.types.js";

export interface RescheduleMeetingInput {
  meetingDatetime: string;
  venue: string;
  attendanceLogbookRef?: string;
  inviteeIds?: string[];
}

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

  void fanoutNotification({
    userId: actorId,
    sourceTable: "adm_parent_meetings",
    action: "reschedule_self",
    message: `You moved the parent meeting for ${studentName} to ${when} — referrals.`,
    sourceId: meeting.id,
  });

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
