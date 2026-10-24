import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";
import { gradeToNumber } from "../../modules/teacher/teacher.repository.js";
import { isMascotCharacter } from "../mascot.js";
import type { TeacherContext } from "./teacher.types.js";

const MASTER_TEACHER_GRADES = new Set([7, 8, 9, 10]);

export function isMasterTeacherEligible(gradeLevels: (string | number)[]): boolean {
  const nums = gradeLevels
    .map(gradeToNumber)
    .filter((n) => n >= 7 && n <= 12);
  if (nums.length === 0) return true;
  return nums.every((n) => MASTER_TEACHER_GRADES.has(n));
}

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

export async function setMasterTeacher(ctx: TeacherContext, isMasterTeacher: boolean) {
  const teacherId = ctx.userId;
  if (isMasterTeacher) {
    const termId = ctx.termId;

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

      await tx.staffProfile.updateMany({
        where: { isMasterTeacher: true, userId: { not: teacherId } },
        data: { isMasterTeacher: false },
      });
      // Use upsert (not updateMany): teachers without a StaffProfile row yet
      // would otherwise get a silent 0-row update — success response, no DB
      // change, Timeslot link never appears.
      await tx.staffProfile.upsert({
        where: { userId: teacherId },
        update: { isMasterTeacher: true },
        create: {
          userId: teacherId,
          employeeId: `T-${teacherId.slice(0, 8)}`,
          isMasterTeacher: true,
        },
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

export async function readProfileSettings(teacherId: string) {
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: teacherId },
      select: { fullName: true },
    }),
    prisma.staffProfile.findUnique({
      where: { userId: teacherId },
      select: { photoUrl: true, mascot: true, primaryColor: true, secondaryColor: true, shareStudentData: true, shareUpdatedAt: true },
    }),
  ]);
  return {
    fullName: user?.fullName ?? "",
    photoUrl: profile?.photoUrl ?? null,
    mascot: profile?.mascot ?? null,
    primaryColor: profile?.primaryColor ?? null,
    secondaryColor: profile?.secondaryColor ?? null,
    shareStudentData: profile?.shareStudentData ?? false,
    shareUpdatedAt: profile?.shareUpdatedAt ?? null,
  };
}

export interface UpdateProfileSettingsInput {
  fullName?: string;
  mascot?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

export async function updateProfileSettings(ctx: TeacherContext, input: UpdateProfileSettingsInput) {
  const teacherId = ctx.userId;
  const { fullName, mascot, primaryColor, secondaryColor } = input;
  if (mascot !== undefined && mascot !== null && !isMascotCharacter(mascot)) {
    throw new AppError(400, "INVALID_MASCOT", "Unknown mascot character.");
  }
  await prisma.$transaction(async (tx) => {
    if (fullName !== undefined) {
      await tx.user.update({
        where: { id: teacherId },
        data: { fullName },
      });
    }
    const palette: { primaryColor?: string | null; secondaryColor?: string | null; mascot?: string | null } = {};
    if (primaryColor !== undefined) palette.primaryColor = primaryColor;
    if (secondaryColor !== undefined) palette.secondaryColor = secondaryColor;
    if (mascot !== undefined) palette.mascot = mascot;
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

export async function readDataSharing(teacherId: string, termId: string | null) {
  const [profile, assignments, linked, advised] = await Promise.all([
    prisma.staffProfile.findUnique({
      where: { userId: teacherId },
      select: { shareStudentData: true, shareUpdatedAt: true },
    }),
    termId
      ? prisma.teacherSubjectAssignment.findMany({
          where: { teacherId, termId },
          select: {
            subject: { select: { name: true } },
            section: { select: { id: true, name: true, adviserId: true } },
          },
        })
      : Promise.resolve([] as { subject: { name: string }; section: { id: string; name: string; adviserId: string | null } }[]),
    termId
      ? prisma.sectionTimetableEntry.findMany({
          where: {
            termId,
            status: { in: ["APPROVED", "SUBMITTED"] },
            teacherName: { userId: teacherId },
          },
          select: {
            subject: { select: { name: true } },
            section: { select: { id: true, name: true, adviserId: true } },
          },
        })
      : Promise.resolve([] as { subject: { name: string }; section: { id: string; name: string; adviserId: string | null } }[]),
    prisma.section.findMany({
      where: { adviserId: teacherId },
      select: { id: true },
    }),
  ]);
  // Handled classes only — never the teacher's own advisory-section classes.
  const advisedIds = new Set(advised.map((s) => s.id));
  const seen = new Map<string, { subject: string; section: string }>();
  for (const a of [...assignments, ...linked]) {
    if (advisedIds.has(a.section.id) || a.section.adviserId === teacherId) continue;
    const key = `${a.subject.name}|${a.section.name}`;
    if (!seen.has(key)) seen.set(key, { subject: a.subject.name, section: a.section.name });
  }
  return {
    shareStudentData: profile?.shareStudentData ?? false,
    shareUpdatedAt: profile?.shareUpdatedAt ?? null,
    handledClasses: [...seen.values()],
  };
}

export async function setDataSharing(ctx: TeacherContext, share: boolean) {
  const teacherId = ctx.userId;
  const now = new Date();
  await prisma.staffProfile.upsert({
    where: { userId: teacherId },
    update: { shareStudentData: share, shareUpdatedAt: now },
    create: {
      userId: teacherId,
      employeeId: `T-${teacherId.slice(0, 8)}`,
      shareStudentData: share,
      shareUpdatedAt: now,
    },
  });
  await writeAudit({
    userId: teacherId,
    actionType: "update",
    sourceTable: "staff_profiles",
    sourceId: teacherId,
    reason: share
      ? "Teacher enabled student-data sharing (Connect/Sync ON)"
      : "Teacher disabled student-data sharing (Connect/Sync OFF)",
  });
  void fanoutNotification({
    userId: teacherId,
    sourceTable: "staff_profiles",
    action: "data_share",
    sourceId: teacherId,
    message: share
      ? "Student-data sharing is ON — your adviser, guidance, and allowed roles now see your grades/attendance in real-time."
      : "Student-data sharing is OFF — only you see the grades/attendance you encode.",
  });
  if (share) {
    void fanoutToRole("principal", {
      sourceTable: "staff_profiles",
      action: "data_share_on",
      sourceId: teacherId,
      excludeUserId: teacherId,
      message: "A teacher enabled student-data sharing.",
    });
    // Connect/Sync flipped ON — re-run the engine now so the adviser's
    // advisees can be auto-detected without waiting for the hourly sweep.
    if (ctx.termId) void recomputeAdvisedRisk(teacherId, ctx.termId);
  }
  return readDataSharing(teacherId, ctx.termId);
}

async function recomputeAdvisedRisk(teacherId: string, termId: string) {
  const { recomputeRisk, recomputeRosterRisk } = await import("../risk.js");
  const sections = await prisma.section.findMany({
    where: { adviserId: teacherId },
    select: { id: true },
  });
  const sectionIds = sections.map((s) => s.id);
  if (sectionIds.length === 0) return;

  const [profiles, rosters] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { sectionId: { in: sectionIds } },
      select: { userId: true },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId: { in: sectionIds } },
      select: { id: true },
    }),
  ]);
  await Promise.allSettled([
    ...profiles.map((p) => recomputeRisk(p.userId, termId)),
    ...rosters.map((r) => recomputeRosterRisk(r.id, termId)),
  ]);
}
