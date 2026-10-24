import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { isMascotCharacter } from "../mascot.js";
import type { DeskIdentity, RegistryContext } from "./registry.types.js";

export async function readProfileSettings(staffId: string) {
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: staffId },
      select: { fullName: true },
    }),
    prisma.staffProfile.findUnique({
      where: { userId: staffId },
      select: { photoUrl: true, mascot: true, primaryColor: true, secondaryColor: true },
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

export async function updateProfileSettings(
  ctx: RegistryContext,
  desk: DeskIdentity,
  input: UpdateProfileSettingsInput,
) {
  const staffId = ctx.userId;
  const { fullName, mascot, primaryColor, secondaryColor } = input;
  if (mascot !== undefined && mascot !== null && !isMascotCharacter(mascot)) {
    throw new AppError(400, "INVALID_MASCOT", "Unknown mascot character.");
  }
  await prisma.$transaction(async (tx) => {
    if (fullName !== undefined) {
      await tx.user.update({
        where: { id: staffId },
        data: { fullName },
      });
    }
    const palette: { primaryColor?: string | null; secondaryColor?: string | null; mascot?: string | null } = {};
    if (primaryColor !== undefined) palette.primaryColor = primaryColor;
    if (secondaryColor !== undefined) palette.secondaryColor = secondaryColor;
    if (mascot !== undefined) palette.mascot = mascot;
    if (Object.keys(palette).length > 0) {
      await tx.staffProfile.upsert({
        where: { userId: staffId },
        update: palette,
        create: {
          userId: staffId,
          employeeId: `${desk.employeePrefix}${staffId.slice(0, 8)}`,
          ...palette,
        },
      });
    }
  });
  await writeAudit({
    userId: staffId,
    actionType: "update",
    sourceTable: "staff_profiles",
    sourceId: staffId,
    reason: `${desk.deskNoun} updated profile settings`,
  });
  return readProfileSettings(staffId);
}

export async function updateProfilePhoto(
  ctx: RegistryContext,
  desk: DeskIdentity,
  photoUrl: string,
) {
  const staffId = ctx.userId;
  await prisma.staffProfile.upsert({
    where: { userId: staffId },
    update: { photoUrl },
    create: {
      userId: staffId,
      employeeId: `${desk.employeePrefix}${staffId.slice(0, 8)}`,
      photoUrl,
    },
  });
  await writeAudit({
    userId: staffId,
    actionType: "update",
    sourceTable: "staff_profiles",
    sourceId: staffId,
    reason: `${desk.deskNoun} updated profile photo`,
  });
  return { photoUrl };
}
