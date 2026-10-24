import { prisma } from "../../lib/prisma.js";
import { writeAudit } from "../../lib/audit.js";
import type { GuidanceContext } from "./guidance.types.js";

export async function readProfileSettings(counselorId: string) {
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: counselorId },
      select: { fullName: true },
    }),
    prisma.staffProfile.findUnique({
      where: { userId: counselorId },
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

export interface UpdateProfileSettingsInput {
  fullName?: string;
  mascot?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

export async function updateProfileSettings(ctx: GuidanceContext, input: UpdateProfileSettingsInput) {
  const counselorId = ctx.userId;
  const { fullName, mascot, primaryColor, secondaryColor } = input;
  await prisma.$transaction(async (tx) => {
    if (fullName !== undefined) {
      await tx.user.update({
        where: { id: counselorId },
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
        where: { userId: counselorId },
        update: palette,
        create: {
          userId: counselorId,
          employeeId: `G-${counselorId.slice(0, 8)}`,
          ...palette,
        },
      });
    }
  });
  await writeAudit({
    userId: counselorId,
    actionType: "update",
    sourceTable: "staff_profiles",
    sourceId: counselorId,
    reason: "Guidance counselor updated profile settings",
  });
  return readProfileSettings(counselorId);
}

export async function updateProfilePhoto(ctx: GuidanceContext, photoUrl: string) {
  const counselorId = ctx.userId;
  await prisma.staffProfile.upsert({
    where: { userId: counselorId },
    update: { photoUrl },
    create: {
      userId: counselorId,
      employeeId: `G-${counselorId.slice(0, 8)}`,
      photoUrl,
    },
  });
  await writeAudit({
    userId: counselorId,
    actionType: "update",
    sourceTable: "staff_profiles",
    sourceId: counselorId,
    reason: "Guidance counselor updated profile photo",
  });
  return { photoUrl };
}
