import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { GRADE_LABEL, formatMeetingAttachment, meetingInviteeInclude, meetingInviteeList } from "../../modules/adm/adm.repository.js";

export async function getCaseFile(id: string) {
  const raw = id;
  const referralPrefix = "referral:";
  const asReferralId = raw.startsWith(referralPrefix)
    ? raw.slice(referralPrefix.length)
    : null;

  let profile: {
    id: string;
    stage: string;
    eligibilityStatus: string;
    referralId: string;
    createdAt: Date;
    approvedAt: Date | null;
    certificationDetails: unknown;
    student: {
      lrn: string;
      gradeLevel: string;
      user: { fullName: string };
    };
    preparedByUser: { fullName: string };
    approvedByUser: { fullName: string } | null;
    forms: {
      id: string;
      formType: string;
      title: string;
      status: string;
      notes: string | null;
      uploadedAt: Date | null;
    }[];
  } | null = null;
  let referralId: string | null = asReferralId;

  if (!referralId) {
    profile = await prisma.admLearnerProfile.findUnique({
      where: { id: raw },
      include: {
        student: { include: { user: { select: { fullName: true } } } },
        preparedByUser: { select: { fullName: true } },
        approvedByUser: { select: { fullName: true } },
        forms: { orderBy: { uploadedAt: "desc" } },
      },
    });
    if (profile) {
      referralId = profile.referralId;
    } else {

      const direct = await prisma.referral.findUnique({
        where: { id: raw },
        select: { id: true },
      });
      if (!direct) throw new AppError(404, "NOT_FOUND", "ADM case not found");
      referralId = direct.id;
    }
  }

  const referral = referralId
    ? await prisma.referral.findUnique({
        where: { id: referralId },
        include: {
          anecdotalRecord: {
            include: {
              observer: { select: { fullName: true } },
              section: { select: { name: true } },
            },
          },
          referredByUser: { select: { fullName: true } },
          student: {
            select: {
              lrn: true,
              gradeLevel: true,
              user: { select: { fullName: true } },
            },
          },
          roster: {
            select: { lrn: true, fullName: true, gradeLevel: true },
          },
          counselingSessions: {
            orderBy: { scheduledAt: "asc" },
            select: {
              id: true,
              sessionType: true,
              scheduledAt: true,
              venue: true,
              status: true,
              sessionNotes: true,
              outcome: true,
            },
          },
        },
      })
    : null;
  if (referralId && !referral) {
    throw new AppError(404, "NOT_FOUND", "ADM case not found");
  }

  if (!profile && referralId) {
    const linked = await prisma.admLearnerProfile.findFirst({
      where: { referralId },
      include: {
        student: { include: { user: { select: { fullName: true } } } },
        preparedByUser: { select: { fullName: true } },
        approvedByUser: { select: { fullName: true } },
        forms: { orderBy: { uploadedAt: "desc" } },
      },
    });
    if (linked) profile = linked;
  }

  const meetings = profile
    ? await prisma.admParentMeeting.findMany({
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
      })
    : referralId
      ? await prisma.admParentMeeting.findMany({
          where: { referralId },
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
        })
      : [];

  const anecdotal = referral?.anecdotalRecord ?? null;
  const studentName =
    profile?.student.user.fullName ??
    referral?.student?.user.fullName ??
    referral?.roster?.fullName ??
    "";
  const lrn =
    profile?.student.lrn ?? referral?.student?.lrn ?? referral?.roster?.lrn ?? "";
  const gradeRaw =
    profile?.student.gradeLevel ??
    referral?.student?.gradeLevel ??
    referral?.roster?.gradeLevel ??
    "";
  const rowId = profile ? profile.id : `referral:${referralId}`;

  return {
    id: rowId,
    kind: profile ? ("profile" as const) : ("referral" as const),
    profileId: profile?.id ?? null,
    referralId,
    student: studentName,
    lrn,
    grade: GRADE_LABEL[gradeRaw] ?? gradeRaw,
    stage: profile?.stage ?? "consultation",
    eligibilityStatus: profile?.eligibilityStatus ?? "pending",
    preparedBy:
      profile?.preparedByUser.fullName ?? referral?.referredByUser.fullName ?? "",
    datePrepared: profile
      ? profile.createdAt.toISOString().slice(0, 10)
      : (anecdotal ? anecdotal.observationDatetime.toISOString().slice(0, 10) : null),
    approvedBy: profile?.approvedByUser?.fullName ?? null,
    approvalDate: profile?.approvedAt
      ? profile.approvedAt.toISOString().slice(0, 10)
      : null,
    certificationDetails: profile?.certificationDetails ?? null,
    referral: referral
      ? {
          id: referral.id,
          reason: referral.reason,
          status: referral.status,
          consultReviewer: referral.consultReviewer,
          referralFormReady: referral.referralFormReady,
          notes: referral.notes,
          priority: referral.priority,
          intakeNotes: referral.intakeNotes,
          resolutionSummary: referral.resolutionSummary,
          referredBy: referral.referredByUser.fullName,
        }
      : null,
    anecdotal: anecdotal
      ? {
          id: anecdotal.id,
          observationDatetime: anecdotal.observationDatetime.toISOString(),
          observationDate: anecdotal.observationDatetime.toISOString().slice(0, 10),
          category: anecdotal.category,
          confidentialityLevel: anecdotal.confidentialityLevel,
          descriptionOfIncident: anecdotal.descriptionOfIncident,
          descriptionOfLocation: anecdotal.descriptionOfLocation,

          recommendations: anecdotal.notesRecommendationsActions,
          classPerformance: anecdotal.classPerformance,
          attendanceSummary: anecdotal.attendanceSummary,
          observer: anecdotal.observer.fullName,
          section: anecdotal.section.name,
        }
      : null,

    gcForm03: referral
      ? { ready: referral.referralFormReady }
      : null,
    forms: (profile?.forms ?? []).map((f) => ({
      id: f.id,
      formType: f.formType,
      title: f.title,
      status: f.status,
      notes: f.notes,
      uploadedAt: f.uploadedAt ? f.uploadedAt.toISOString() : null,
    })),
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
    sessions: (referral?.counselingSessions ?? []).map((s) => ({
      id: s.id,
      sessionType: s.sessionType,
      scheduledAt: s.scheduledAt.toISOString(),
      venue: s.venue,
      status: s.status,
      sessionNotes: s.sessionNotes,
      outcome: s.outcome,
    })),
  };
}
