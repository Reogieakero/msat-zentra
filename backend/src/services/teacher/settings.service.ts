import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";
import { gradeToNumber } from "../../modules/teacher/teacher.repository.js";
import type { TeacherContext } from "./teacher.types.js";

// Master Teacher is a grades 7–10 designation. Pure so it stays unit-tested
// without a DB: eligible when every known grade sits in that band, or when
// nothing is assigned yet (new teachers declare first).
const MASTER_TEACHER_GRADES = new Set([7, 8, 9, 10]);

export function isMasterTeacherEligible(gradeLevels: (string | number)[]): boolean {
  const nums = gradeLevels
    .map(gradeToNumber)
    .filter((n) => n >= 7 && n <= 12);
  if (nums.length === 0) return true;
  return nums.every((n) => MASTER_TEACHER_GRADES.has(n));
}

// Adviser section options for Settings ("Are you an adviser?"). Lists every
// section in the active school year with its holder, flagging which ones
// appear in the master teacher's schedule (committed timetable entries this
// term) so the picker can prefer schedule sections. Claimable = unclaimed;
// advisedByMe = already mine.
export async function listAdviserSections(ctx: TeacherContext) {
  const teacherId = ctx.userId;
  const termId = ctx.termId;
  const yearId = ctx.schoolYearId;
  const sectionWhere = yearId ? { schoolYearId: yearId } : {};
  const [sections, scheduled] = await Promise.all([
    prisma.section.findMany({
      where: sectionWhere,
      orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        gradeLevel: true,
        adviserLabel: true,
        adviserCode: true,
        adviserId: true,
        adviser: { select: { fullName: true } },
      },
    }),
    termId
      ? prisma.sectionTimetableEntry.findMany({
          where: { termId },
          select: { sectionId: true },
          distinct: ["sectionId"],
        })
      : Promise.resolve([] as { sectionId: string }[]),
  ]);
  const scheduledIds = new Set(scheduled.map((s) => s.sectionId));
  return {
    sections: sections.map((s) => ({
      id: s.id,
      name: s.name,
      gradeLevel: s.gradeLevel,
      gradeNumber: gradeToNumber(s.gradeLevel),
      adviserLabel: (s as { adviserLabel?: string | null }).adviserLabel ?? "",
      claimable: s.adviserId === null,
      advisedByMe: s.adviserId === teacherId,
      holderName: s.adviserId && s.adviserId !== teacherId ? (s.adviser?.fullName ?? null) : null,
      inMasterSchedule: scheduledIds.has(s.id),
      hasCode: !!((s as { adviserCode?: string | null }).adviserCode ?? null),
    })),
  };
}

// Self-declared Master Teacher designation (grades 7–10 only). The grade
// band is re-resolved server-side from this term's assignments + advised
// sections, so a tampered client cannot claim it from grades 11–12.
// Turning it off is always allowed.
export async function setMasterTeacher(ctx: TeacherContext, isMasterTeacher: boolean) {
  const teacherId = ctx.userId;
  if (isMasterTeacher) {
    const termId = ctx.termId;
    // Only one Master Teacher at a time — validate the grade band
    // first, so we never leave the DB in a half-cleared state.
    const [assignments, advised] = await Promise.all([
      termId
        ? prisma.teacherSubjectAssignment.findMany({
            where: { teacherId, termId },
            select: { section: { select: { gradeLevel: true } } },
          })
        : Promise.resolve([]),
      termId
        ? prisma.section.findMany({
            where: { adviserId: teacherId },
            select: { gradeLevel: true },
          })
        : Promise.resolve([]),
    ]);
    const gradeLevels = [
      ...(assignments as { section: { gradeLevel: string } }[]).map(
        (a) => a.section.gradeLevel
      ),
      ...(advised as { gradeLevel: string }[]).map((s) => s.gradeLevel),
    ];
    if (!isMasterTeacherEligible(gradeLevels)) {
      throw new AppError(
        403,
        "GRADE_BAND_NOT_ALLOWED",
        "Master Teacher designation is only available for grades 7–10"
      );
    }
    // Singleton seat: if another ACTIVE teacher already holds it, refuse
    // to steal — they must turn it off first. Checked inside an
    // interactive transaction so concurrent claims cannot both win.
    // Inactive holders are treated as stale and cleared.
    let holderName: string | null = null;
    await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findFirst({
        where: {
          id: { not: teacherId },
          status: "active",
          staffProfile: { isMasterTeacher: true },
        },
        select: { fullName: true },
      });
      if (existing) {
        holderName = existing.fullName;
        throw new AppError(
          409,
          "MASTER_TEACHER_TAKEN",
          holderName
            ? `Master Teacher is currently designated by ${holderName} — ask them to turn it off first`
            : "Master Teacher is currently designated — try again after it is turned off"
        );
      }
      // No active holder: clear any stale flags, then claim.
      await tx.staffProfile.updateMany({
        where: { isMasterTeacher: true, userId: { not: teacherId } },
        data: { isMasterTeacher: false },
      });
      await tx.staffProfile.updateMany({
        where: { userId: teacherId },
        data: { isMasterTeacher: true },
      });
    });
  } else {
    await prisma.staffProfile.updateMany({
      where: { userId: teacherId },
      data: { isMasterTeacher: false },
    });
  }
  await writeAudit({
    userId: teacherId,
    actionType: "update",
    sourceTable: "staff_profiles",
    sourceId: teacherId,
    reason: isMasterTeacher
      ? "Teacher declared Master Teacher status"
      : "Teacher removed Master Teacher status",
  });

  // Seat take/release is desk-visible: masters + principal learn live,
  // and the actor keeps a self receipt. Best-effort, never delays.
  if (isMasterTeacher) {
    void fanoutToRole("principal", {
      sourceTable: "staff_profiles",
      action: "master_take",
      sourceId: teacherId,
      excludeUserId: teacherId,
      message: "A teacher declared Master Teacher status.",
    });
  }
  void fanoutNotification({
    userId: teacherId,
    sourceTable: "staff_profiles",
    action: "master_take",
    sourceId: teacherId,
    message: isMasterTeacher
      ? "You declared Master Teacher status."
      : "You removed Master Teacher status.",
  });
  return { isMasterTeacher };
}

// Teacher profile settings (Settings page): display name, photo, and the
// workspace palette. Reads/writes the teacher's own User + StaffProfile rows
// (profile row upserted — teachers created before it existed have none).
export async function readProfileSettings(teacherId: string) {
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: teacherId },
      select: { fullName: true },
    }),
    prisma.staffProfile.findUnique({
      where: { userId: teacherId },
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

export async function updateProfileSettings(ctx: TeacherContext, input: UpdateProfileSettingsInput) {
  const teacherId = ctx.userId;
  const { fullName, primaryColor, secondaryColor } = input;
  await prisma.$transaction(async (tx) => {
    if (fullName !== undefined) {
      await tx.user.update({
        where: { id: teacherId },
        data: { fullName },
      });
    }
    const palette: { primaryColor?: string | null; secondaryColor?: string | null } = {};
    if (primaryColor !== undefined) palette.primaryColor = primaryColor;
    if (secondaryColor !== undefined) palette.secondaryColor = secondaryColor;
    if (Object.keys(palette).length > 0) {
      await tx.staffProfile.upsert({
        where: { userId: teacherId },
        update: palette,
        create: {
          userId: teacherId,
          employeeId: `T-${teacherId.slice(0, 8)}`,
          ...palette,
        },
      });
    }
  });
  await writeAudit({
    userId: teacherId,
    actionType: "update",
    sourceTable: "staff_profiles",
    sourceId: teacherId,
    reason: "Teacher updated profile settings",
  });
  return readProfileSettings(teacherId);
}

// Profile photo upload (JSON data URL — same storage shape as the drawn
// signature). PNG/JPEG/GIF/WebP only, 2MB cap so rows stay lean.
export async function updateProfilePhoto(ctx: TeacherContext, photoUrl: string) {
  const teacherId = ctx.userId;
  await prisma.staffProfile.upsert({
    where: { userId: teacherId },
    update: { photoUrl },
    create: {
      userId: teacherId,
      employeeId: `T-${teacherId.slice(0, 8)}`,
      photoUrl,
    },
  });
  await writeAudit({
    userId: teacherId,
    actionType: "update",
    sourceTable: "staff_profiles",
    sourceId: teacherId,
    reason: "Teacher updated profile photo",
  });
  return { photoUrl };
}
