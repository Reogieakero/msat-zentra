import { prisma } from "../../lib/prisma.js";
import { writeAudit } from "../../lib/audit.js";
import type { DeskIdentity, RegistryContext } from "./registry.types.js";

export async function readProfileSettings(staffId: string) {
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: staffId },
      select: { fullName: true },
    }),
    prisma.staffProfile.findUnique({
      where: { userId: staffId },
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

export interface UpdateProfileSettingsInput {
  fullName?: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

export async function updateProfileSettings(
  ctx: RegistryContext,
  desk: DeskIdentity,
  input: UpdateProfileSettingsInput,
) {
  const staffId = ctx.userId;
  const { fullName, primaryColor, secondaryColor } = input;
  await prisma.$transaction(async (tx) => {
    if (fullName !== undefined) {
      await tx.user.update({
        where: { id: staffId },
        data: { fullName },
      });
    }
    const palette: { primaryColor?: string | null; secondaryColor?: string | null } = {};
    if (primaryColor !== undefined) palette.primaryColor = primaryColor;
    if (secondaryColor !== undefined) palette.secondaryColor = secondaryColor;
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

// Profile photo upload (JSON data URL). PNG/JPEG/GIF/WebP only, 2MB cap so
// rows stay lean.
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
