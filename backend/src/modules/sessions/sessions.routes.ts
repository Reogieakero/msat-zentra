import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();

export interface UpcomingSessionRow {
  sessionId: string;
  sourceTable: "referrals" | "interventions";
  sourceId: string;
  track: string;
  student: string;
  section: string;
  sessionType: string;
  scheduledAt: string;
  venue: string;
  status: string;
}

const SESSION_SELECT = {
  id: true,
  sessionType: true,
  scheduledAt: true,
  venue: true,
  status: true,
} as const;

// Status-only upcoming sessions connected to the signed-in user — the
// reminder card's data source (sileo + bell stay notification-driven).
// Times + venues only: no session notes, outcomes, reasons, or
// documentation ever leave this endpoint, so adviser visibility is safe.
// No term scoping: a scheduled session is inherently current, whatever
// term filed it.
router.get("/upcoming", requireAuth, async (req, res, next) => {
  try {
    const me = req.user!.id;
    const role = req.user!.role as string;
    const out: UpcomingSessionRow[] = [];

    const pushReferralSession = (
      r: {
        id: string;
        referredToRole: string;
        student: { user: { fullName: string } | null; section: { name: string } | null } | null;
        roster: { fullName: string; section: { name: string } | null } | null;
      },
      s: { id: string; sessionType: string; scheduledAt: Date; venue: string | null; status: string }
    ) => {
      const student = r.student?.user?.fullName ?? r.roster?.fullName ?? "the student";
      const section = r.student?.section?.name ?? r.roster?.section?.name ?? "";
      out.push({
        sessionId: s.id,
        sourceTable: "referrals",
        sourceId: r.id,
        track: r.referredToRole === "adm_coordinator" ? "ADM" : r.referredToRole === "nurse" ? "Clinic" : "Counseling",
        student: section ? `${student} (${section})` : student,
        section,
        sessionType: s.sessionType,
        scheduledAt: s.scheduledAt.toISOString(),
        venue: s.venue ?? "",
        status: s.status,
      });
    };

    const referralInclude = {
      referredToRole: true,
      student: {
        select: {
          user: { select: { fullName: true } },
          section: { select: { name: true } },
        },
      },
      roster: {
        select: { fullName: true, section: { select: { name: true } } },
      },
      counselingSessions: {
        where: { status: "scheduled" },
        select: SESSION_SELECT,
      },
    } as const;

    if (role === "nurse") {
      const referrals = await prisma.referral.findMany({
        where: {
          OR: [
            { referredToRole: "nurse" },
            { referredToRole: "adm_coordinator", consultReviewer: "nurse" },
          ],
        },
        select: { id: true, ...referralInclude },
      });
      for (const r of referrals) {
        for (const s of r.counselingSessions) pushReferralSession(r, s);
      }
    } else if (role === "guidance_counselor") {
      const [referrals, interventions] = await Promise.all([
        prisma.referral.findMany({
          where: {
            OR: [
              { referredToRole: "guidance_counselor" },
              {
                referredToRole: "adm_coordinator",
                OR: [{ consultReviewer: null }, { consultReviewer: "guidance_counselor" }],
              },
            ],
          },
          select: { id: true, ...referralInclude },
        }),
        prisma.intervention.findMany({
          where: { assignedTo: me },
          select: {
            id: true,
            student: {
              select: {
                user: { select: { fullName: true } },
                section: { select: { name: true } },
              },
            },
            roster: {
              select: { fullName: true, section: { select: { name: true } } },
            },
            counselingSessions: {
              where: { status: "scheduled" },
              select: SESSION_SELECT,
            },
          },
        }),
      ]);
      for (const r of referrals) {
        for (const s of r.counselingSessions) pushReferralSession(r, s);
      }
      for (const iv of interventions) {
        const student =
          iv.student?.user?.fullName ?? iv.roster?.fullName ?? "the student";
        const section = iv.student?.section?.name ?? iv.roster?.section?.name ?? "";
        for (const s of iv.counselingSessions) {
          out.push({
            sessionId: s.id,
            sourceTable: "interventions",
            sourceId: iv.id,
            track: "Follow-up",
            student: section ? `${student} (${section})` : student,
            section,
            sessionType: s.sessionType,
            scheduledAt: s.scheduledAt.toISOString(),
            venue: s.venue ?? "",
            status: s.status,
          });
        }
      }
    } else if (role === "adviser" || role === "subject_teacher") {
      const [referrals, interventions] = await Promise.all([
        prisma.referral.findMany({
          where: { referredBy: me },
          select: { id: true, ...referralInclude },
        }),
        prisma.intervention.findMany({
          where: {
            OR: [
              { assignedTo: me },
              { student: { section: { adviserId: me } } },
              { roster: { section: { adviserId: me } } },
            ],
          },
          select: {
            id: true,
            student: {
              select: {
                user: { select: { fullName: true } },
                section: { select: { name: true } },
              },
            },
            roster: {
              select: { fullName: true, section: { select: { name: true } } },
            },
            counselingSessions: {
              where: { status: "scheduled" },
              select: SESSION_SELECT,
            },
          },
        }),
      ]);
      for (const r of referrals) {
        for (const s of r.counselingSessions) pushReferralSession(r, s);
      }
      for (const iv of interventions) {
        const student =
          iv.student?.user?.fullName ?? iv.roster?.fullName ?? "the student";
        const section = iv.student?.section?.name ?? iv.roster?.section?.name ?? "";
        for (const s of iv.counselingSessions) {
          out.push({
            sessionId: s.id,
            sourceTable: "interventions",
            sourceId: iv.id,
            track: "Follow-up",
            student: section ? `${student} (${section})` : student,
            section,
            sessionType: s.sessionType,
            scheduledAt: s.scheduledAt.toISOString(),
            venue: s.venue ?? "",
            status: s.status,
          });
        }
      }
    }

    out.sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1));
    res.json(out.slice(0, 50));
  } catch (e) {
    next(e);
  }
});

export default router;
