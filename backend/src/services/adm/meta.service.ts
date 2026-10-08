import { prisma } from "../../lib/prisma.js";
import { writeAudit } from "../../lib/audit.js";
import { ADM_STAGES, ADM_STAGE_FLOW } from "../adm.js";
import type { AdmContext } from "./adm.types.js";

export async function listPipeline() {
  return { stages: ADM_STAGES, flow: ADM_STAGE_FLOW };
}

export interface StaffQuery {
  referralId: string | null;
  profileId: string | null;
}

export async function listInvitableStaff(query: StaffQuery) {
  const { referralId, profileId } = query;
  let sectionAdviserId: string | null = null;
  if (profileId) {
    const p = await prisma.admLearnerProfile.findUnique({
      where: { id: profileId },
      select: {
        student: { select: { section: { select: { adviserId: true } } } },
      },
    });
    sectionAdviserId = p?.student?.section?.adviserId ?? null;
  } else if (referralId) {
    const r = await prisma.referral.findUnique({
      where: { id: referralId },
      select: {
        student: { select: { section: { select: { adviserId: true } } } },
        roster: { select: { section: { select: { adviserId: true } } } },
      },
    });
    sectionAdviserId =
      r?.student?.section?.adviserId ?? r?.roster?.section?.adviserId ?? null;
  }
  const scoped = referralId !== null || profileId !== null;

  const staff = await prisma.user.findMany({
    where: {
      status: "active",
      OR: [
        { role: { in: ["nurse", "guidance_counselor"] } },

        ...(scoped && sectionAdviserId
          ? [{ id: sectionAdviserId }]
          : scoped
            ? [{ id: "__none__" }]
            : [{ role: "adviser" as const }]),
      ],
    },
    select: { id: true, fullName: true, role: true },
    orderBy: [{ role: "asc" }, { fullName: "asc" }],
  });
  return { staff, sectionAdviserId: scoped ? sectionAdviserId : null };
}

export async function readCoordinatorProfileSettings(coordinatorId: string) {
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: coordinatorId },
      select: { fullName: true },
    }),
    prisma.staffProfile.findUnique({
      where: { userId: coordinatorId },
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

export async function updateProfileSettings(ctx: AdmContext, input: UpdateProfileSettingsInput) {
  const coordinatorId = ctx.userId;
  const { fullName, primaryColor, secondaryColor } = input;
  await prisma.$transaction(async (tx) => {
    if (fullName !== undefined) {
      await tx.user.update({
        where: { id: coordinatorId },
        data: { fullName },
      });
    }
    const palette: { primaryColor?: string | null; secondaryColor?: string | null } = {};
    if (primaryColor !== undefined) palette.primaryColor = primaryColor;
    if (secondaryColor !== undefined) palette.secondaryColor = secondaryColor;
    if (Object.keys(palette).length > 0) {
      await tx.staffProfile.upsert({
        where: { userId: coordinatorId },
        update: palette,
        create: {
          userId: coordinatorId,
          employeeId: `A-${coordinatorId.slice(0, 8)}`,
          ...palette,
        },
      });
    }
  });
  await writeAudit({
    userId: coordinatorId,
    actionType: "update",
    sourceTable: "staff_profiles",
    sourceId: coordinatorId,
    reason: "ADM coordinator updated profile settings",
  });
  return readCoordinatorProfileSettings(coordinatorId);
}

export async function updateProfilePhoto(ctx: AdmContext, photoUrl: string) {
  const coordinatorId = ctx.userId;
  await prisma.staffProfile.upsert({
    where: { userId: coordinatorId },
    update: { photoUrl },
    create: {
      userId: coordinatorId,
      employeeId: `A-${coordinatorId.slice(0, 8)}`,
      photoUrl,
    },
  });
  await writeAudit({
    userId: coordinatorId,
    actionType: "update",
    sourceTable: "staff_profiles",
    sourceId: coordinatorId,
    reason: "ADM coordinator updated profile photo",
  });
  return { photoUrl };
}
