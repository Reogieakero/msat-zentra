import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification } from "../../lib/notify.js";
import { adviserSectionsOr404 } from "../../modules/teacher/advisory.repository.js";
import {
  notifyMastersTeacherLinkChanged,
} from "../../modules/teacher/teacher.repository.js";
import type { TeacherContext } from "./teacher.types.js";

export async function listTeachers() {
  const rows = await prisma.teacherName.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, userId: true },
  });

  return {
    teachers: rows.map((t) => ({ id: t.id, name: t.name, code: t.code, linked: !!t.userId })),
  };
}

export async function getMyLink(ctx: TeacherContext) {
  const teacherId = ctx.userId;
  const [mine, profile] = await Promise.all([
    prisma.teacherName.findUnique({
      where: { userId: teacherId },
      select: { id: true, name: true, code: true },
    }),
    prisma.staffProfile.findUnique({
      where: { userId: teacherId },
      select: { isMasterTeacher: true },
    }),
  ]);
  const termId = ctx.termId;
  let termGrant: { via: string; attendanceVerified: boolean } | null = null;
  if (termId) {
    const grant = await prisma.teacherTermGrant.findUnique({
      where: { userId_termId: { userId: teacherId, termId } },
      select: { via: true, attendanceVerifiedAt: true },
    });
    if (grant) {
      termGrant = { via: grant.via, attendanceVerified: grant.attendanceVerifiedAt !== null };
    }
  }
  return {
    teacherName: mine
      ? {
          id: mine.id,
          name: mine.name,
          code: mine.code,

          attendanceVerified: termGrant?.attendanceVerified ?? false,
        }
      : null,
    termGrant,
    isMasterTeacher: profile?.isMasterTeacher ?? false,
  };
}

export async function enterTermGrant(ctx: TeacherContext) {
  const teacherId = ctx.userId;
  const termId = ctx.termId;
  if (!termId) {
    throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
  }

  await adviserSectionsOr404(teacherId, ctx.schoolYearId);
  const mine = await prisma.teacherName.findUnique({
    where: { userId: teacherId },
    select: { id: true },
  });
  const grant = await prisma.teacherTermGrant.upsert({
    where: { userId_termId: { userId: teacherId, termId } },
    update: { via: "adviser" },
    create: {
      userId: teacherId,
      termId,
      via: "adviser",
      teacherNameId: mine?.id ?? null,
    },
    select: { via: true, attendanceVerifiedAt: true },
  });
  await writeAudit({
    userId: teacherId,
    actionType: "update",
    sourceTable: "teacher_term_grants",
    sourceId: `${teacherId}|${termId}`,
    reason: "Teacher entered term workspace as adviser",
  });
  return {
    termGrant: { via: grant.via, attendanceVerified: grant.attendanceVerifiedAt !== null },
  };
}

export async function claimCode(ctx: TeacherContext, code: string) {
  const teacherId = ctx.userId;
  const cleaned = (code ?? "").trim();
  if (!cleaned) {
    throw new AppError(400, "CODE_REQUIRED", "Enter the code from your teacher list entry");
  }
  const mine = await prisma.teacherName.findUnique({
    where: { userId: teacherId },
    select: { id: true, name: true, code: true },
  });
  if (mine) {
    throw new AppError(
      409,
      "ALREADY_LINKED",
      `This login is already linked to ${mine.name}${mine.code ? ` (${mine.code})` : ""}`
    );
  }
  const row = await prisma.teacherName.findFirst({
    where: { code: { equals: cleaned, mode: "insensitive" } },
  });
  if (!row || !row.code) {
    throw new AppError(
      404,
      "CODE_NOT_FOUND",
      "No teacher list entry uses this code — check with your Master Teacher"
    );
  }
  if (row.userId && row.userId !== teacherId) {
    throw new AppError(409, "CODE_TAKEN", "This code is already linked to another login");
  }
  const linked = await prisma.teacherName.update({
    where: { id: row.id },
    data: { userId: teacherId },
    select: { id: true, name: true, code: true },
  });
  await writeAudit({
    userId: teacherId,
    actionType: "update",
    sourceTable: "teacher_names",
    sourceId: linked.id,
    reason: `Teacher linked login to teacher list entry ${linked.name} (${linked.code})`,
  });

  void notifyMastersTeacherLinkChanged(linked.id, linked.name, linked.code, "claim");

  void fanoutNotification({
    userId: teacherId,
    sourceTable: "teacher_names",
    action: "claim_self",
    sourceId: linked.id,
    message: `You linked code ${linked.code ?? "—"} (${linked.name}) to your login.`,
  });
  return { teacherName: linked };
}

export async function verifyAttendance(ctx: TeacherContext, code: string) {
  const teacherId = ctx.userId;
  const termId = ctx.termId;
  if (!termId) {
    throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
  }
  const cleaned = (code ?? "").trim();
  if (!cleaned) {
    throw new AppError(400, "CODE_REQUIRED", "Enter your teacher code to open attendance");
  }
  const mine = await prisma.teacherName.findUnique({
    where: { userId: teacherId },
    select: { id: true, name: true, code: true },
  });
  if (!mine) {
    throw new AppError(
      409,
      "NOT_LINKED",
      "No schedule link code found — link your code in My Classes first"
    );
  }
  if (!mine.code || mine.code.trim().toUpperCase() !== cleaned.toUpperCase()) {
    throw new AppError(
      403,
      "CODE_MISMATCH",
      "This code is not the same as your schedule link code. Check My Classes for the code you linked and try again"
    );
  }

  await prisma.teacherTermGrant.upsert({
    where: { userId_termId: { userId: teacherId, termId } },
    update: { via: "code", teacherNameId: mine.id, attendanceVerifiedAt: new Date() },
    create: {
      userId: teacherId,
      termId,
      via: "code",
      teacherNameId: mine.id,
      attendanceVerifiedAt: new Date(),
    },
  });
  const result = { verified: true, teacherName: { id: mine.id, name: mine.name, code: mine.code } };
  void (async () => {
    try {
      const masters = await prisma.user.findMany({
        where: { status: "active", staffProfile: { isMasterTeacher: true } },
        select: { id: true },
      });
      await fanoutNotification({
        userId: teacherId,
        sourceTable: "teacher_names",
        action: "attendance_unlock",
        sourceId: mine.id,
        message: `You unlocked attendance with code ${mine.code} — per-subject sheets are now open.`,
      });
      await Promise.all(
        masters
          .filter((m) => m.id !== teacherId)
          .map((m) =>
            fanoutNotification({
              userId: m.id,
              sourceTable: "teacher_names",
              action: "attendance_unlock",
              sourceId: mine.id,
              message: `${mine.name} unlocked attendance with code ${mine.code}.`,
            })
          )
      );
    } catch {

    }
  })();
  return result;
}

export async function leaveTerm(ctx: TeacherContext) {
  const teacherId = ctx.userId;
  const termId = ctx.termId;
  if (!termId) {
    throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
  }
  const mine = await prisma.teacherName.findUnique({
    where: { userId: teacherId },
    select: { id: true, name: true, code: true },
  });
  if (!mine) {
    throw new AppError(404, "NOT_LINKED", "This login is not linked to any teacher list entry");
  }

  await prisma.teacherTermGrant.deleteMany({
    where: { userId: teacherId, termId },
  });
  await writeAudit({
    userId: teacherId,
    actionType: "update",
    sourceTable: "teacher_term_grants",
    sourceId: mine.id,
    reason: "Teacher left the active term (per-term leave; link and other terms kept)",
  });
  return { released: true };
}
