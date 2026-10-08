import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { invalidateTags } from "../../lib/cache.js";
import { writeAudit } from "../../lib/audit.js";

const router = Router();

const HEX_COLOR = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a #RRGGBB hex value");

async function readPrincipalProfileSettings(principalId: string) {
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: principalId },
      select: { fullName: true },
    }),
    prisma.staffProfile.findUnique({
      where: { userId: principalId },
      select: { photoUrl: true, primaryColor: true, secondaryColor: true },
    }),
  ]);
  return {
    fullName: user?.fullName ?? "",
    photoUrl: profile?.photoUrl ?? null,
    primaryColor: profile?.primaryColor ?? null,
    secondaryColor: profile?.secondaryColor ?? null,
  };
}

router.get(
  "/settings/profile",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      res.json(await readPrincipalProfileSettings(req.user!.id));
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  "/settings/profile",
  requireAuth,
  requireRole("principal"),
  validate(
    "body",
    z.object({
      fullName: z.string().trim().min(1).max(100).optional(),
      primaryColor: HEX_COLOR.nullable().optional(),
      secondaryColor: HEX_COLOR.nullable().optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const principalId = req.user!.id;
      const { fullName, primaryColor, secondaryColor } = req.body as {
        fullName?: string;
        primaryColor?: string | null;
        secondaryColor?: string | null;
      };
      await prisma.$transaction(async (tx) => {
        if (fullName !== undefined) {
          await tx.user.update({
            where: { id: principalId },
            data: { fullName },
          });
        }
        const palette: { primaryColor?: string | null; secondaryColor?: string | null } = {};
        if (primaryColor !== undefined) palette.primaryColor = primaryColor;
        if (secondaryColor !== undefined) palette.secondaryColor = secondaryColor;
        if (Object.keys(palette).length > 0) {
          await tx.staffProfile.upsert({
            where: { userId: principalId },
            update: palette,
            create: {
              userId: principalId,
              employeeId: `P-${principalId.slice(0, 8)}`,
              ...palette,
            },
          });
        }
      });
      await writeAudit({
        userId: principalId,
        actionType: "update",
        sourceTable: "staff_profiles",
        sourceId: principalId,
        reason: "Principal updated profile settings",
      });
      await invalidateTags(["principal", "overview"]);
      res.json(await readPrincipalProfileSettings(principalId));
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/settings/photo",
  requireAuth,
  requireRole("principal"),
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
      const principalId = req.user!.id;
      const { photoUrl } = req.body as { photoUrl: string };
      await prisma.staffProfile.upsert({
        where: { userId: principalId },
        update: { photoUrl },
        create: {
          userId: principalId,
          employeeId: `P-${principalId.slice(0, 8)}`,
          photoUrl,
        },
      });
      await writeAudit({
        userId: principalId,
        actionType: "update",
        sourceTable: "staff_profiles",
        sourceId: principalId,
        reason: "Principal updated profile photo",
      });
      await invalidateTags(["principal", "overview"]);
      res.json({ photoUrl });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
