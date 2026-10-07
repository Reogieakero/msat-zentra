import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { invalidateTags } from "../../lib/cache.js";
import { fanoutNotification } from "../../lib/notify.js";
import { adviserSectionsOr404 } from "../../modules/teacher/advisory.routes.js";
import { recomputeRisk, recomputeRosterRisk } from "../risk.js";
import {
  mondayOf,
  phDayKey,
  phWeekday,
} from "../../modules/attendance/attendance.repository.js";
import type { AttendanceContext } from "./attendance.types.js";

export type BulkStatus = "present" | "absent" | "late" | "excused";

export interface BulkRecord {
  studentId: string;
  status: BulkStatus;
}

export interface LegacyBulkInput {
  sectionId: string;
  termId: string;
  date: string;
  session?: "AM" | "PM";
  records: BulkRecord[];
}

// Legacy AM/PM path (adviser-only, frozen behavior).
export async function submitLegacyBulk(ctx: AttendanceContext, input: LegacyBulkInput) {
  const { sectionId, termId, date, records } = input;
  const teacherId = ctx.userId;
  if (ctx.role !== "adviser") {
    throw new AppError(403, "FORBIDDEN", "Legacy AM/PM attendance is adviser-only");
  }
  const legacySession: "AM" | "PM" = input.session ?? "AM";
  // 1. The section must be one of the caller's advisory sections.
  const sections = await adviserSectionsOr404(teacherId);
  if (!sections.some((s) => s.id === sectionId)) {
    throw new AppError(403, "FORBIDDEN", "Section is not in your advisory");
  }
  // Per-term verification gate: advisory sheets need this term's grant.
  const legacyGrant = await prisma.teacherTermGrant.findUnique({
    where: { userId_termId: { userId: teacherId, termId } },
    select: { id: true },
  });
  if (!legacyGrant) {
    throw new AppError(
      403,
      "TERM_NOT_VERIFIED",
      "Continue as adviser for this term to take attendance"
    );
  }

  // 2. Date rules (Philippines calendar day): no future, no weekends,
  //    past days locked (EOD lock — no override in v1).
  const recordDay = phDayKey(new Date(date));
  const todayKey = phDayKey(new Date());
  if (recordDay > todayKey) {
    throw new AppError(422, "FUTURE_DATE", "Cannot take attendance for a future date");
  }
  if (phWeekday(recordDay) === 0 || phWeekday(recordDay) === 6) {
    throw new AppError(422, "WEEKEND", "Cannot take attendance on a weekend");
  }
  if (recordDay < todayKey) {
    // Same-week grace: days earlier this week (Mon–Sun) stay editable;
    // anything older is locked.
    if (mondayOf(recordDay) !== mondayOf(todayKey)) {
      throw new AppError(403, "PAST_LOCKED", "Days before this week are locked");
    }
  }
  const normalizedDate = new Date(`${recordDay}T00:00:00Z`);

  // 3. Every student must be enrolled in the section — registered
  // profiles, or roster enlistments (`roster:<id>`, no account needed).
  const studentIds = Array.from(new Set(records.map((r: { studentId: string }) => r.studentId)));
  const rosterIds = studentIds
    .filter((id) => id.startsWith("roster:"))
    .map((id) => id.slice("roster:".length));
  const profileIds = studentIds.filter((id) => !id.startsWith("roster:"));
  const [enrolledProfiles, rosterEntries] = await Promise.all([
    profileIds.length > 0
      ? prisma.studentProfile.count({ where: { userId: { in: profileIds }, sectionId } })
      : Promise.resolve(0),
    rosterIds.length > 0
      ? prisma.studentRoster.findMany({
          where: { id: { in: rosterIds }, sectionId },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);
  if (enrolledProfiles !== profileIds.length || rosterEntries.length !== rosterIds.length) {
    throw new AppError(422, "STUDENT_NOT_IN_SECTION", "One or more students are not in this section");
  }
  const keyOf = (studentId: string | null, rosterId: string | null) =>
    rosterId ? `roster:${rosterId}` : (studentId as string);

  // 4. Previous marks (same calendar day) — notifications fire only when
  //    a status newly becomes absent/late, never on plain resubmits.
  const previous = await prisma.attendanceRecord.findMany({
    where: {
      OR: [
        ...(profileIds.length > 0 ? [{ studentId: { in: profileIds } }] : []),
        ...(rosterIds.length > 0 ? [{ rosterId: { in: rosterIds } }] : []),
      ],
      session: legacySession,
      date: {
        gte: new Date(`${recordDay}T00:00:00Z`),
        lt: new Date(new Date(`${recordDay}T00:00:00Z`).getTime() + 86_400_000),
      },
    },
    select: { id: true, studentId: true, rosterId: true, status: true },
  });
  const prevByStudent = new Map(previous.map((p) => [keyOf(p.studentId, p.rosterId), p]));
  // Snapshot of pre-write statuses for the notification check below —
  // prevByStudent gets overwritten with fresh writes in the write loop.
  const prevStatus = new Map(previous.map((p) => [keyOf(p.studentId, p.rosterId), p.status]));
  const names = new Map(
    (
      await prisma.user.findMany({
        where: { id: { in: profileIds } },
        select: { id: true, fullName: true },
      })
    ).map((u) => [u.id, u.fullName])
  );

  // Day-scoped write (not raw timestamp upsert): legacy rows may carry
  // non-midnight timestamps, so match by calendar day to avoid stacking
  // two rows for one student/day/session. One $transaction round-trip
  // for the whole sheet (was: await inside for loop).
  const updateKeys: string[] = [];
  const createKeys: string[] = [];
  const writeOps: Array<Promise<unknown>> = [];
  for (const r of records) {
    const existing = prevByStudent.get(r.studentId);
    const isRoster = r.studentId.startsWith("roster:");
    const rosterId = isRoster ? r.studentId.slice("roster:".length) : null;
    if (existing) {
      updateKeys.push(r.studentId);
      writeOps.push(
        prisma.attendanceRecord.update({
          where: { id: existing.id },
          data: { status: r.status, sectionId, recordedBy: teacherId, date: normalizedDate },
        }),
      );
    } else {
      createKeys.push(r.studentId);
      writeOps.push(
        prisma.attendanceRecord.create({
          data: {
            studentId: isRoster ? null : r.studentId,
            rosterId,
            sectionId,
            termId,
            date: normalizedDate,
            session: legacySession,
            status: r.status,
            recordedBy: teacherId,
          },
          select: { id: true },
        }),
      );
    }
  }
  const writeRows = (await prisma.$transaction(writeOps as never[])) as Array<{
    id: string;
  }>;
  const written: { id: string; studentId: string }[] = [
    ...updateKeys.map((studentId, i) => ({
      id: (writeRows[i] as { id: string }).id,
      studentId,
    })),
    ...createKeys.map((studentId, i) => ({
      id: (writeRows[updateKeys.length + i] as { id: string }).id,
      studentId,
    })),
  ];
  const statusByStudent = new Map(records.map((r) => [r.studentId, r.status]));
  for (const w of written) {
    const isRoster = w.studentId.startsWith("roster:");
    // Later duplicates in the same payload see the fresh write.
    prevByStudent.set(w.studentId, {
      id: w.id,
      studentId: isRoster ? null : w.studentId,
      rosterId: isRoster ? w.studentId.slice("roster:".length) : null,
      status: statusByStudent.get(w.studentId) ?? "present",
    });
  }
  const byStudent = new Map(written.map((w) => [`${w.studentId}|${legacySession}`, w]));
  // Parent pings queue here and flush void-after-res below so the
  // confirmed response never waits on per-parent fan-outs.
  const pendingParentPings: Array<{
    userId: string;
    studentId: string;
    recordId: string;
    status: string;
  }> = [];

  // Risk recompute in parallel; parent links in ONE batched query
  // (was: sequential awaits + one findMany per flagged student).
  const uniqueIds = Array.from(new Set(records.map((r) => r.studentId)));
  await Promise.all(
    uniqueIds.map((id) =>
      // Risk + parent notifications only apply to registered profiles.
      // Roster enlistments get the roster risk path (snapshot +
      // auto-intervention, no parent links).
      id.startsWith("roster:")
        ? recomputeRosterRisk(id.slice("roster:".length), termId)
        : recomputeRisk(id, termId),
    ),
  );
  const flaggedProfiles = uniqueIds.filter((id) => {
    if (id.startsWith("roster:")) return false;
    const prev = prevStatus.get(id);
    const rec = statusByStudent.get(id);
    return (
      (rec === "absent" || rec === "late") &&
      prev !== "absent" &&
      prev !== "late"
    );
  });
  const parentLinks =
    flaggedProfiles.length > 0
      ? await prisma.parentStudentLink.findMany({
          where: { studentId: { in: flaggedProfiles } },
          select: { parentId: true, studentId: true },
        })
      : [];
  for (const p of parentLinks) {
    const record = byStudent.get(`${p.studentId}|${legacySession}`);
    pendingParentPings.push({
      userId: p.parentId,
      studentId: p.studentId,
      recordId: record?.id ?? p.studentId,
      status: statusByStudent.get(p.studentId) ?? "absent",
    });
  }

  await writeAudit({
    userId: teacherId,
    actionType: "attendance_submit",
    sourceTable: "attendance_records",
    sourceId: `${sectionId}|${recordDay}|${legacySession}`,
    reason: `Bulk attendance: ${written.length} marks (${legacySession} ${recordDay})`,
  });

  return {
    count: written.length,
    parentPings: pendingParentPings.map((ping) => ({
      userId: ping.userId,
      sourceTable: "attendance_records",
      action: "create",
      sourceId: ping.recordId,
      message: `${names.get(ping.studentId) ?? "Your child"} was marked ${ping.status} for the ${legacySession} session on ${recordDay}.`,
    })),
  };
}

export interface SubjectBulkInput {
  sectionId: string;
  termId: string;
  subjectId: string;
  assignmentId?: string;
  slot: number;
  date: string;
  records: BulkRecord[];
}

// Per-subject bulk write. Authorization is assignment-anchored:
// - subject_teacher callers must hold TeacherSubjectAssignment
//   { teacherId, subjectId, sectionId, termId };
// - adviser callers must own the section AND the subject must be offered there
//   (an assignment row exists for subject+section+term, any holder).
// - every student must be enrolled in the section (profile or roster).
// Duplicate prevention: unique (student|roster, subjectId, dateDay, slot).
export async function submitSubjectBulk(ctx: AttendanceContext, input: SubjectBulkInput) {
  const { sectionId, termId, subjectId, assignmentId, slot, date, records } = input;
  const teacherId = ctx.userId;
  const callerRole = ctx.role;

  // 0. Per-term verification gate (auth flow per term): this term must hold
  // a grant row for the caller. Advisory-section sheets open on any grant;
  // code-linked sections additionally require the verified code unlock.
  const grant = await prisma.teacherTermGrant.findUnique({
    where: { userId_termId: { userId: teacherId, termId } },
    select: { via: true, attendanceVerifiedAt: true },
  });
  if (!grant) {
    throw new AppError(
      403,
      "TERM_NOT_VERIFIED",
      "Verify this term to take attendance — enter your code or continue as adviser for this term"
    );
  }
  const advisoryIds = await adviserSectionsOr404(teacherId).catch(() => [] as { id: string }[]);
  if (!advisoryIds.some((s) => s.id === sectionId) && !grant.attendanceVerifiedAt) {
    throw new AppError(
      403,
      "TERM_NOT_VERIFIED",
      "Verify your teacher code for this term to take attendance in this section"
    );
  }

  // 1. Subject must be offered in this section+term.
  const offerings = await prisma.teacherSubjectAssignment.findMany({
    where: { subjectId, sectionId, termId },
    include: { subject: { select: { name: true, code: true } } },
  });
  if (offerings.length === 0) {
    throw new AppError(422, "SUBJECT_NOT_OFFERED", "Subject is not offered in this section for this term");
  }
  const subjectLabel = offerings[0]?.subject.name ?? "the subject";

  // 2. Caller authorization.
  let effectiveAssignmentId: string | null = null;
  if (callerRole === "adviser") {
    const sections = await adviserSectionsOr404(teacherId);
    if (!sections.some((s) => s.id === sectionId)) {
      throw new AppError(403, "FORBIDDEN", "Section is not in your advisory");
    }
    if (assignmentId) {
      if (!offerings.some((o) => o.id === assignmentId)) {
        throw new AppError(422, "BAD_ASSIGNMENT", "Assignment does not match subject/section/term");
      }
      effectiveAssignmentId = assignmentId;
    } else {
      effectiveAssignmentId = offerings[0]!.id;
    }
  } else {
    // subject_teacher (or any non-adviser role reaching here): must hold the
    // assignment — or a committed timetable slot attached to their linked
    // teacher-list code for this subject + section + term.
    const own = offerings.filter((o) => o.teacherId === teacherId);
    let linked = false;
    if (own.length === 0) {
      const linkedSlot = await prisma.sectionTimetableEntry.findFirst({
        where: {
          subjectId,
          sectionId,
          termId,
          status: { in: ["APPROVED", "SUBMITTED"] },
          teacherName: { userId: teacherId },
        },
        select: { id: true },
      });
      linked = !!linkedSlot;
      if (!linked) {
        throw new AppError(403, "FORBIDDEN", "You are not assigned to teach this subject in this section");
      }
    }
    if (assignmentId) {
      const pool = own.length > 0 ? own : offerings;
      if (!pool.some((o) => o.id === assignmentId)) {
        throw new AppError(403, "FORBIDDEN", "Assignment belongs to another teacher");
      }
      effectiveAssignmentId = assignmentId;
    } else {
      effectiveAssignmentId = own[0]?.id ?? offerings[0]!.id;
    }
  }

  // 3. Date rules — identical to the legacy path (PH day, no future/weekend,
  //    same-week grace).
  const recordDay = phDayKey(new Date(date));
  const todayKey = phDayKey(new Date());
  if (recordDay > todayKey) {
    throw new AppError(422, "FUTURE_DATE", "Cannot take attendance for a future date");
  }
  if (phWeekday(recordDay) === 0 || phWeekday(recordDay) === 6) {
    throw new AppError(422, "WEEKEND", "Cannot take attendance on a weekend");
  }
  if (recordDay < todayKey && mondayOf(recordDay) !== mondayOf(todayKey)) {
    throw new AppError(403, "PAST_LOCKED", "Days before this week are locked");
  }
  const normalizedDate = new Date(`${recordDay}T00:00:00Z`);
  const dayStart = new Date(`${recordDay}T00:00:00Z`);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  // 4. Enrollment check (profile or roster, section-scoped).
  const studentIds = Array.from(new Set(records.map((r) => r.studentId)));
  const rosterIds = studentIds
    .filter((id) => id.startsWith("roster:"))
    .map((id) => id.slice("roster:".length));
  const profileIds = studentIds.filter((id) => !id.startsWith("roster:"));
  const [enrolledProfiles, rosterEntries] = await Promise.all([
    profileIds.length > 0
      ? prisma.studentProfile.count({ where: { userId: { in: profileIds }, sectionId } })
      : Promise.resolve(0),
    rosterIds.length > 0
      ? prisma.studentRoster.findMany({ where: { id: { in: rosterIds }, sectionId }, select: { id: true } })
      : Promise.resolve([]),
  ]);
  if (enrolledProfiles !== profileIds.length || rosterEntries.length !== rosterIds.length) {
    throw new AppError(422, "STUDENT_NOT_IN_SECTION", "One or more students are not in this section");
  }
  const keyOf = (studentId: string | null, rosterId: string | null) =>
    rosterId ? `roster:${rosterId}` : (studentId as string);

  // 5. Previous marks for this (subject, day, slot) — upsert, never stack.
  const previous = await prisma.attendanceRecord.findMany({
    where: {
      OR: [
        ...(profileIds.length > 0 ? [{ studentId: { in: profileIds } }] : []),
        ...(rosterIds.length > 0 ? [{ rosterId: { in: rosterIds } }] : []),
      ],
      subjectId,
      slot,
      date: { gte: dayStart, lt: dayEnd },
    },
    select: { id: true, studentId: true, rosterId: true, status: true },
  });
  const prevByStudent = new Map(previous.map((p) => [keyOf(p.studentId, p.rosterId), p]));
  const prevStatus = new Map(previous.map((p) => [keyOf(p.studentId, p.rosterId), p.status]));
  const names = new Map(
    (
      await prisma.user.findMany({
        where: { id: { in: profileIds } },
        select: { id: true, fullName: true },
      })
    ).map((u) => [u.id, u.fullName])
  );

  // Batched write: one $transaction round-trip for the whole sheet instead
  // of N sequential update/create round-trips (was: await inside for loop).
  // Updates keep their order first, creates after — the flat result array
  // follows the same order, so ids map back positionally.
  const updateKeys: string[] = [];
  const createKeys: string[] = [];
  const writeOps: Array<Promise<unknown>> = [];
  for (const r of records) {
    const existing = prevByStudent.get(r.studentId);
    const isRoster = r.studentId.startsWith("roster:");
    const rosterId = isRoster ? r.studentId.slice("roster:".length) : null;
    if (existing) {
      updateKeys.push(r.studentId);
      writeOps.push(
        prisma.attendanceRecord.update({
          where: { id: existing.id },
          data: {
            status: r.status,
            sectionId,
            recordedBy: teacherId,
            date: normalizedDate,
            subjectId,
            assignmentId: effectiveAssignmentId,
            slot,
          },
        }),
      );
    } else {
      createKeys.push(r.studentId);
      writeOps.push(
        prisma.attendanceRecord.create({
          data: {
            studentId: isRoster ? null : r.studentId,
            rosterId,
            sectionId,
            termId,
            date: normalizedDate,
            session: "AM", // placeholder — session is frozen (legacy reads only)
            status: r.status,
            recordedBy: teacherId,
            subjectId,
            assignmentId: effectiveAssignmentId,
            slot,
          },
          select: { id: true },
        }),
      );
    }
  }
  const writtenRows = (await prisma.$transaction(
    writeOps as never[],
  )) as Array<{ id: string }>;
  const written: { id: string; studentId: string }[] = [
    ...updateKeys.map((studentId, i) => ({
      id: (writtenRows[i] as { id: string }).id,
      studentId,
    })),
    ...createKeys.map((studentId, i) => ({
      id: (writtenRows[updateKeys.length + i] as { id: string }).id,
      studentId,
    })),
  ];
  const statusByStudent = new Map(records.map((r) => [r.studentId, r.status]));
  for (const w of written) {
    const isRoster = w.studentId.startsWith("roster:");
    prevByStudent.set(w.studentId, {
      id: w.id,
      studentId: isRoster ? null : w.studentId,
      rosterId: isRoster ? w.studentId.slice("roster:".length) : null,
      status: statusByStudent.get(w.studentId) ?? "present",
    });
  }
  const byStudent = new Map(written.map((w) => [w.studentId, w]));
  // Parent pings queue here and flush void-after-res below so the
  // confirmed response never waits on per-parent fan-outs.
  const pendingParentPings: Array<{
    userId: string;
    studentId: string;
    recordId: string;
    status: string;
  }> = [];

  // Risk recompute runs in parallel (one promise per student, was: sequential
  // await in loop). Parent links resolve with ONE batched query for all
  // newly-flagged profiles (was: one findMany per flagged student).
  const uniqueIds = Array.from(new Set(records.map((r) => r.studentId)));
  await Promise.all(
    uniqueIds.map((id) =>
      id.startsWith("roster:")
        ? recomputeRosterRisk(id.slice("roster:".length), termId)
        : recomputeRisk(id, termId),
    ),
  );
  const flaggedProfiles = uniqueIds.filter((id) => {
    if (id.startsWith("roster:")) return false;
    const rec = records.find((r) => r.studentId === id);
    const prev = prevStatus.get(id);
    return (
      !!rec &&
      (rec.status === "absent" || rec.status === "late") &&
      prev !== "absent" &&
      prev !== "late"
    );
  });
  const parentLinks =
    flaggedProfiles.length > 0
      ? await prisma.parentStudentLink.findMany({
          where: { studentId: { in: flaggedProfiles } },
          select: { parentId: true, studentId: true },
        })
      : [];
  const recordByStudent = new Map(records.map((r) => [r.studentId, r]));
  for (const link of parentLinks) {
    const rec = recordByStudent.get(link.studentId);
    const record = byStudent.get(link.studentId);
    pendingParentPings.push({
      userId: link.parentId,
      studentId: link.studentId,
      recordId: record?.id ?? link.studentId,
      status: rec?.status ?? "absent",
    });
  }

  await writeAudit({
    userId: teacherId,
    actionType: "attendance_submit",
    sourceTable: "attendance_records",
    sourceId: `${sectionId}|${subjectId}|${recordDay}|slot${slot}`,
    reason: `Bulk subject attendance: ${written.length} marks (${subjectLabel} ${recordDay} slot ${slot})`,
  });

  return {
    count: written.length,
    recordDay,
    subjectLabel,
    parentPings: pendingParentPings.map((ping) => ({
      userId: ping.userId,
      sourceTable: "attendance_records",
      action: "subject_create",
      sourceId: ping.recordId,
      message: `${names.get(ping.studentId) ?? "Your child"} was marked ${ping.status} in ${subjectLabel} on ${recordDay}.`,
    })),
    adviserNotice: { sectionId, subjectLabel, recordDay, slot, count: written.length },
  };
}
