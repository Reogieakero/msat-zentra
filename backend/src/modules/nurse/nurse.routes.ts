import { Router, type Request } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cache, invalidateTags } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { writeAudit } from "../../lib/audit.js";
import { registryProfileSchema } from "../registry/registry.schemas.js";
import { getNurseCalendar } from "../../services/nurse/schedule.service.js";
import navCountsRoutes from "./navCounts.routes.js";

const router = Router();

router.use(navCountsRoutes);

function nurseContext(req: Request) {
  return {
    userId: req.user!.id,
    termId: req.termScope?.termId ?? null,
  };
}

/**
 * The clinic desk calendar: every booked session/meeting in a date window, one
 * merged payload. `from`/`to` are ISO instants (the client sends its local
 * month/week boundaries) so the range never clips a session at a timezone edge.
 */
router.get(
  "/calendar",
  requireAuth,
  requireRole("nurse"),
  cache({
    tags: [CACHE_TAGS.nurse, CACHE_TAGS.referrals],
    // Live booking board — the same short TTL as the guidance calendar so a
    // 15s poll never serves a pre-booking payload for long.
    ttl: CACHE_TTLS.counts,
  }),
  etag(),
  async (req, res, next) => {
    try {
      const from = typeof req.query.from === "string" ? req.query.from : "";
      const to = typeof req.query.to === "string" ? req.query.to : "";
      const status = req.query.status === "scheduled" ? "scheduled" : "all";
      res.json(await getNurseCalendar(nurseContext(req), { from, to, status }));
    } catch (e) {
      next(e);
    }
  }
);

async function readNurseProfileSettings(nurseId: string) {
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: nurseId },
      select: { fullName: true },
    }),
    prisma.staffProfile.findUnique({
      where: { userId: nurseId },
      select: {
        photoUrl: true,
        mascot: true,
        primaryColor: true,
        secondaryColor: true,
      },
    }),
  ]);
  return {
    fullName: user?.fullName ?? "",
    photoUrl: profile?.photoUrl ?? null,
    mascot: profile?.mascot ?? null,
    primaryColor: profile?.primaryColor ?? null,
    secondaryColor: profile?.secondaryColor ?? null,
  };
}

router.get(
  "/settings/profile",
  requireAuth,
  requireRole("nurse"),
  async (req, res, next) => {
    try {
      res.json(await readNurseProfileSettings(req.user!.id));
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  "/settings/profile",
  requireAuth,
  requireRole("nurse"),
  validate("body", registryProfileSchema),
  async (req, res, next) => {
    try {
      const nurseId = req.user!.id;
      const { fullName, mascot, primaryColor, secondaryColor } = req.body as {
        fullName?: string;
        mascot?: string | null;
        primaryColor?: string | null;
        secondaryColor?: string | null;
      };
      await prisma.$transaction(async (tx) => {
        if (fullName !== undefined) {
          await tx.user.update({
            where: { id: nurseId },
            data: { fullName },
          });
        }
        const palette: {
          primaryColor?: string | null;
          secondaryColor?: string | null;
          mascot?: string | null;
        } = {};
        if (primaryColor !== undefined) palette.primaryColor = primaryColor;
        if (secondaryColor !== undefined) palette.secondaryColor = secondaryColor;
        if (mascot !== undefined) palette.mascot = mascot;
        if (Object.keys(palette).length > 0) {
          await tx.staffProfile.upsert({
            where: { userId: nurseId },
            update: palette,
            create: {
              userId: nurseId,
              employeeId: `N-${nurseId.slice(0, 8)}`,
              ...palette,
            },
          });
        }
      });
      await writeAudit({
        userId: nurseId,
        actionType: "update",
        sourceTable: "staff_profiles",
        sourceId: nurseId,
        reason: "Nurse updated profile settings",
      });
      await invalidateTags(["nurse", "overview"]);
      res.json(await readNurseProfileSettings(nurseId));
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/settings/photo",
  requireAuth,
  requireRole("nurse"),
  validate(
    "body",
    z.object({
      photoUrl: z
        .string()
        .regex(/^data:image\/(png|jpeg|gif|webp);base64,/, "Photo must be a PNG, JPEG, GIF, or WebP data URL")
        .max(2_800_000),
    })
  ),
  async (req, res, next) => {
    try {
      const nurseId = req.user!.id;
      const { photoUrl } = req.body as { photoUrl: string };
      await prisma.staffProfile.upsert({
        where: { userId: nurseId },
        update: { photoUrl },
        create: {
          userId: nurseId,
          employeeId: `N-${nurseId.slice(0, 8)}`,
          photoUrl,
        },
      });
      await writeAudit({
        userId: nurseId,
        actionType: "update",
        sourceTable: "staff_profiles",
        sourceId: nurseId,
        reason: "Nurse updated profile photo",
      });
      await invalidateTags(["nurse", "overview"]);
      res.json({ photoUrl });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
