import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";
import type { AdmStage } from "../adm.js";
import { actorName } from "../../modules/adm/adm.repository.js";
import type { AdmContext } from "./adm.types.js";

const INVITABLE_ROLES = ["nurse", "guidance_counselor", "adviser", "subject_teacher"] as const;

export const PRE_CERT_STAGES: AdmStage[] = ["anecdotal", "consultation", "meeting_parents"];

export async function resolveInvitees(
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

export async function saveMeetingInvitees(
  meetingId: string,
  invitees: { id: string; fullName: string }[],
): Promise<void> {
  if (invitees.length === 0) return;
  await prisma.admMeetingInvitee.createMany({
    data: invitees.map((u) => ({ meetingId, userId: u.id })),
    skipDuplicates: true,
  });
}

export function inviteeNames(invitees: { fullName: string }[]): string {
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

    void fanoutNotification({
      userId: ctx.userId,
      sourceTable: "adm_parent_meetings",
      action: "book_self",
      message: `You booked a parent meeting for ${studentName} on ${when} (${venueLabel}) — referrals.`,
      sourceId: meeting.id,
    });
  }

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

  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "adm_parent_meetings",
    action: "book",
    message: `You booked a parent meeting for ${studentName} on ${when} (${venueLabel}).`,
    sourceId: meeting.id,
  });

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
