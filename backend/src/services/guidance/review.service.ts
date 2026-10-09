import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification } from "../../lib/notify.js";
import { GUIDANCE_SESSION_TYPES } from "../../modules/guidance/guidance.repository.js";
import type { GuidanceContext } from "./guidance.types.js";

export interface ConsultReviewInput {
  recommendation: string;
  outcome: "endorse" | "reject";
  clinicSession?: { scheduledAt?: unknown; sessionType?: unknown; venue?: unknown };
}

export async function reviewConsultation(
  ctx: GuidanceContext,
  referralId: string,
  input: ConsultReviewInput,
) {

  const [referral, profileCount] = await Promise.all([
    prisma.referral.findUnique({
      where: { id: referralId },
    }),
    prisma.admLearnerProfile.count({
      where: { referralId },
    }),
  ]);
  if (
    !referral ||
    referral.referredToRole !== "adm_coordinator" ||
    profileCount > 0
  ) {
    throw new AppError(
      404,
      "NOT_ADM_CONSULTATION",
      "Only an ADM referral awaiting consultation review can be reviewed here"
    );
  }

  if (referral.status !== "pending") {
    throw new AppError(
      400,
      "INVALID_ACTION",
      "This case has already been decided"
    );
  }

  if (
    referral.consultReviewer &&
    referral.consultReviewer !== "guidance_counselor"
  ) {
    throw new AppError(
      403,
      "NOT_YOUR_QUEUE",
      "This case was routed to another consultation reviewer"
    );
  }

  if (ctx.termId && referral.termId !== ctx.termId) {
    throw new AppError(404, "NOT_FOUND", "Referral not found in the active term");
  }
  const { recommendation, outcome } = input;

  if (outcome === "endorse") {
    const active = await prisma.counselingSession.count({
      where: { referralId: referral.id, status: "scheduled" },
    });
    if (active > 0) {
      throw new AppError(
        400,
        "ACTIVE_SESSION_EXISTS",
        "This referral already has a session that is not done yet — finish or cancel it before endorsing"
      );
    }
  }

  let sessionAt: Date | null = null;
  let sessionType = "individual";
  let sessionVenue: string | null = null;
  const clinicInput = input.clinicSession;
  if (clinicInput && outcome === "endorse") {
    sessionAt = new Date(String(clinicInput.scheduledAt ?? ""));
    if (Number.isNaN(sessionAt.getTime())) {
      throw new AppError(400, "INVALID_DATE", "Pick a valid date and time for the session");
    }
    if (sessionAt.getTime() <= Date.now()) {
      throw new AppError(400, "INVALID_ACTION", "Session must be set in the future");
    }
    const kind = String(clinicInput.sessionType ?? "individual");
    if (!(GUIDANCE_SESSION_TYPES as readonly string[]).includes(kind)) {
      throw new AppError(400, "INVALID_ACTION", "Unknown session type");
    }
    sessionType = kind;
    sessionVenue =
      typeof clinicInput.venue === "string" && clinicInput.venue.trim()
        ? clinicInput.venue.trim()
        : null;
  }
  const note = `[ADM consult] ${recommendation.trim()}`;

  const applied = await prisma.referral.updateMany({
    where: { id: referral.id, status: "pending" },
    data:
      outcome === "endorse"
        ? {
            status: "in_progress",
            notes: referral.notes ? `${referral.notes}\n${note}` : note,
            consultReviewedAt: new Date(),
          }
        : {
            status: "dismissed",
            notes: referral.notes ? `${referral.notes}\n${note}` : note,
            consultReviewedAt: new Date(),
          },
  });
  if (applied.count === 0) {
    throw new AppError(
      400,
      "INVALID_ACTION",
      "This case has already been decided"
    );
  }
  const updated = await prisma.referral.findUnique({
    where: { id: referral.id },
  });
  if (outcome === "endorse") {
    await writeAudit({
      userId: ctx.userId,
      actionType: "referral_status_change",
      sourceTable: "referrals",
      sourceId: referral.id,
      reason: `ADM consultation endorsed: ${recommendation.trim()}${sessionAt ? " with a session booked" : ""}`,
      oldValue: { status: referral.status },
      newValue: { status: "in_progress" },
    });

    try {
      const coordinators = await prisma.user.findMany({
        where: { role: "adm_coordinator", status: "active" },
        select: { id: true },
        take: 10,
      });
      await Promise.all(
        coordinators
          .filter((c) => c.id !== ctx.userId)
          .map((c) =>
            fanoutNotification({
              userId: c.id,
              sourceTable: "referrals",
              action: "status",
              message: "ADM consultation endorsed — ready for the parent meeting.",
              sourceId: referral.id,
            })
          )
      );
    } catch {

    }
  } else {
    await writeAudit({
      userId: ctx.userId,
      actionType: "referral_dismissed",
      sourceTable: "referrals",
      sourceId: referral.id,
      reason: `ADM consultation rejected: ${recommendation.trim()}`,
      oldValue: { status: referral.status },
      newValue: { status: "dismissed" },
    });
  }
  if (sessionAt) {
    const created = await prisma.counselingSession.create({
      data: {
        referralId: referral.id,
        sessionType,
        scheduledAt: sessionAt,
        venue: sessionVenue,
        status: "scheduled",
        createdBy: ctx.userId,
      },
    });
    await writeAudit({
      userId: ctx.userId,
      actionType: "session_scheduled",
      sourceTable: "counseling_sessions",
      sourceId: created.id,
      reason: "Session booked on ADM consultation endorse",
      oldValue: null,
      newValue: { sessionType: created.sessionType, scheduledAt: created.scheduledAt },
    });
  }

  if (outcome === "endorse") {
    if (referral.referredBy && referral.referredBy !== ctx.userId) {
      void fanoutNotification({
        userId: referral.referredBy,
        sourceTable: "referrals",
        action: "status",
        message: "ADM consultation endorsed — now with the coordinator.",
        sourceId: referral.id,
      });
    }
    void fanoutNotification({
      userId: ctx.userId,
      sourceTable: "referrals",
      action: "status",
      message: "You endorsed an ADM consultation — sent to the coordinator.",
      sourceId: referral.id,
    });
  } else {
    if (referral.referredBy && referral.referredBy !== ctx.userId) {
      void fanoutNotification({
        userId: referral.referredBy,
        sourceTable: "referrals",
        action: "status",
        message: "Your ADM referral was not endorsed — case closed.",
        sourceId: referral.id,
      });
    }
    void fanoutNotification({
      userId: ctx.userId,
      sourceTable: "referrals",
      action: "status",
      message: "You did not endorse an ADM referral — case closed.",
      sourceId: referral.id,
    });
  }
  return updated;
}
