import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { scopedTermRow, schoolYearWhere, scopedYearId } from "../../lib/termScope.js";
import { validate } from "../../middleware/validate.js";
import { writeAudit } from "../../lib/audit.js";
import { invalidateTags } from "../../lib/cache.js";
import { fanoutNotification } from "../../lib/notify.js";
import { adviserSectionsOr404, teachableSectionIds } from "../teacher/advisory.routes.js";
import {
  computeAttendanceRate,
  computeSubjectAttendanceRate,
  buildDayAxis,
  buildSchoolDayAxis,
  manilaKey,
  phTodayKey,
  countSchoolDays,
  formatDateKey,
  isWeekendKey,
  groupSectionDay,
  groupSubjectDay,
  dailyPresentPercent,
  avgPresentPercent,
  below80Days,
  attendanceTrend,
  buildOfferedMap,
  sectionStrictDays,
  studentDayOutcomes,
  type AttendanceStatus,
  type DayAgg,
} from "../../services/attendance.js";
import { recomputeRisk, recomputeRosterRisk } from "../../services/risk.js";
import { sweepAutoAbsent } from "../../services/autoAbsent.js";
import { rosterCountsByGrade, sectionHeadcounts } from "../../services/enrollment.js";
import type { GradeLevel } from "../../generated/prisma/client.js";

const router = Router();

const recordSchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(["present", "absent", "late", "excused"]),
});

// Per-subject bulk contract. `session` is legacy-only: when `subjectId` is
// present the subject path runs (slot disambiguates same-day repeats);
// otherwise the frozen AM/PM path runs (adviser-only, unchanged behavior).
const bulkSchema = z.object({
  sectionId: z.string().min(1),
  termId: z.string().min(1),
  date: z.string().datetime(),
  subjectId: z.string().min(1).optional(),
  assignmentId: z.string().min(1).optional(),
  slot: z.coerce.number().int().min(1).max(10).optional().default(1),
  session: z.enum(["AM", "PM"]).optional(),
  // Bound: one class sheet per request — caps payload and write fan-out.
  records: z.array(recordSchema).min(1).max(300),
});

// Philippines calendar day (school operates on local time).
function phDayKey(d: Date): string {
  return new Date(d.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}
// Display term for heatblocks: the session's active term when the request
// carries one (Login → select → scope); otherwise the term whose
// [startDate, endDate] contains today (Manila), falling back to Term 1 when
// nothing matches (e.g. dates unset) so legacy behavior is preserved.
async function resolveDisplayTerm(req?: Request): Promise<{
  id: string;
  termNumber: number;
  startDate: Date | null;
} | null> {
  if (req?.termScope) {
    const s = req.termScope;
    return {
      id: s.termId,
      termNumber: s.termNumber,
      startDate: s.startDate ? new Date(s.startDate) : null,
    };
  }
  const terms = await prisma.term.findMany({
    where: { schoolYear: { isActive: true } },
    orderBy: { termNumber: "asc" },
    select: { id: true, termNumber: true, startDate: true, endDate: true },
  });
  if (terms.length === 0) return null;
  const today = manilaKey(new Date());
  const current = terms.find((t) => {
    const s = t.startDate ? manilaKey(t.startDate) : null;
    const e = t.endDate ? manilaKey(t.endDate) : null;
    return (!s || s <= today) && (!e || today <= e);
  });
  const hit = current ?? terms[0]!;
  return { id: hit.id, termNumber: hit.termNumber, startDate: hit.startDate };
}
function phWeekday(dayKey: string): number {
  return new Date(`${dayKey}T00:00:00Z`).getUTCDay();
}
// Monday (PH) starting the week containing the given PH day key.
function mondayOf(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * 86_400_000).toISOString().slice(0, 10);
}

router.post(
  "/bulk",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  validate("body", bulkSchema),
  async (req, res, next) => {
    try {
      const { sectionId, termId: bodyTermId, date, subjectId, assignmentId, slot, session, records } =
        req.body as z.infer<typeof bulkSchema>;
      // Transactions are always saved under the session's active term —
      // the client never picks a term per action.
      const termId = req.termScope?.termId ?? bodyTermId;
      const teacherId = req.user!.id;
      const callerRole = req.user!.role;

      // Subject path (new model) vs legacy AM/PM path (frozen behavior).
      if (subjectId) {
        await handleSubjectBulk({
          teacherId,
          callerRole,
          sectionId,
          termId,
          subjectId,
          assignmentId,
          slot: slot ?? 1,
          date,
          records,
          res,
        });
        return;
      }

      // ---- Legacy AM/PM path (adviser-only, unchanged) ----
      if (callerRole !== "adviser") {
        throw new AppError(403, "FORBIDDEN", "Legacy AM/PM attendance is adviser-only");
      }
      const legacySession: "AM" | "PM" = session ?? "AM";
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
      // Attendance stats feed cached overview/teacher pages; recomputes
      // above can open guidance interventions + risk levels.
      await invalidateTags(["overview", "principal", "teacher", "risk", "guidance", "reports"]);

      res.status(201).json({ count: written.length });
      for (const ping of pendingParentPings) {
        void fanoutNotification({
          userId: ping.userId,
          sourceTable: "attendance_records",
          action: "create",
          sourceId: ping.recordId,
          message: `${names.get(ping.studentId) ?? "Your child"} was marked ${ping.status} for the ${legacySession} session on ${recordDay}.`,
        });
      }
    } catch (e) { next(e); }
  }
);

interface SubjectBulkInput {
  teacherId: string;
  callerRole: string;
  sectionId: string;
  termId: string;
  subjectId: string;
  assignmentId?: string;
  slot: number;
  date: string;
  records: { studentId: string; status: "present" | "absent" | "late" | "excused" }[];
  res: Response;
}

// Per-subject bulk write. Authorization is assignment-anchored:
// - subject_teacher callers must hold TeacherSubjectAssignment
//   { teacherId, subjectId, sectionId, termId };
// - adviser callers must own the section AND the subject must be offered there
//   (an assignment row exists for subject+section+term, any holder).
// - every student must be enrolled in the section (profile or roster).
// Duplicate prevention: unique (student|roster, subjectId, dateDay, slot).
async function handleSubjectBulk(input: SubjectBulkInput): Promise<void> {
  const { teacherId, callerRole, sectionId, termId, subjectId, assignmentId, slot, date, records, res } = input;

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
  await invalidateTags(["overview", "principal", "teacher", "risk", "reports", "guidance"]);

  res.status(201).json({ count: written.length, subjectId, slot });
  for (const ping of pendingParentPings) {
    void fanoutNotification({
      userId: ping.userId,
      sourceTable: "attendance_records",
      action: "subject_create",
      sourceId: ping.recordId,
      message: `${names.get(ping.studentId) ?? "Your child"} was marked ${ping.status} in ${subjectLabel} on ${recordDay}.`,
    });
  }
  // The section adviser learns in realtime (toast + bell) that per-subject
  // attendance landed — best-effort, never delays this response.
  void (async () => {
    try {
      const section = await prisma.section.findUnique({
        where: { id: sectionId },
        select: { name: true, adviserId: true },
      });
      if (section?.adviserId && section.adviserId !== teacherId) {
        await fanoutNotification({
          userId: section.adviserId,
          sourceTable: "attendance_records",
          action: "subject_submit",
          sourceId: sectionId,
          message: `${written.length} attendance marks for ${subjectLabel} (${section.name}, ${recordDay} slot ${slot}) were submitted.`,
        });
      }
    } catch {
      // Logged inside fanoutNotification; never throws outward.
    }
  })();
}

const GRADE_ORDER = ["G7", "G8", "G9", "G10", "G11", "G12"] as const;

// Manual auto-absent sweep: materialize absent rows for elapsed subject
// meetups the teacher never took (same run the hourly job performs).
// Principal-gated; idempotent — re-runs create nothing new.
router.post(
  "/sweep-absent",
  requireAuth,
  requireRole("principal"),
  async (_req, res, next) => {
    try {
      const result = await sweepAutoAbsent();
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);const GRADE_LABEL: Record<string, string> = {
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};

// Attendance heat map: per-grade, per-day present/total rates split by AM/PM session.
router.get(
  "/heatmap",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const session: "AM" | "PM" = req.query.session === "PM" ? "PM" : "AM";
      const statusFilter =
        req.query.status === "late" ||
        req.query.status === "absent" ||
        req.query.status === "excused"
          ? (req.query.status as "late" | "absent" | "excused")
          : "present";
      const activeTerm = await scopedTermRow(req);
      const termId = activeTerm?.id;
      const where = { session, ...(termId ? { termId } : {}) };

      const records = await prisma.attendanceRecord.findMany({
        where,
        select: {
          date: true,
          status: true,
          student: { select: { gradeLevel: true } },
          roster: { select: { gradeLevel: true } },
        },
        orderBy: { date: "asc" },
      });

      // Authoritative denominator: number of enrolled students per year level
      // (roster-aware — enlisted students without accounts count too).
      const enrolledByGrade: Record<string, number> = {};
      const [enrollCounts, rosterByGrade] = await Promise.all([
        prisma.studentProfile.groupBy({
          by: ["gradeLevel"],
          _count: { _all: true },
        }),
        rosterCountsByGrade([...GRADE_ORDER] as GradeLevel[]),
      ]);
      for (const e of enrollCounts) enrolledByGrade[e.gradeLevel] = e._count._all;
      for (const [gl, n] of rosterByGrade) enrolledByGrade[gl] = (enrolledByGrade[gl] ?? 0) + n;

      // Build a continuous date axis from the term start date to today (Manila
      // day — the current date's block exists immediately) so every grade card
      // shows the same number of blocks aligned to the same dates.
      const start = activeTerm?.startDate
        ? new Date(activeTerm.startDate.toISOString().slice(0, 10) + "T00:00:00Z")
        : null;
      const today = new Date(phTodayKey() + "T00:00:00Z");
      const axisStart = start ?? records[0]?.date ?? today;
      const dayKeys: string[] = [];
      for (let d = new Date(axisStart); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
        dayKeys.push(d.toISOString().slice(0, 10));
      }

      // Count non-absent records per grade/day. Absent is derived so every
      // enrolled student is accounted for even when a record was never submitted.
      const gradeDayStatus: Record<string, Map<string, { present: number; late: number; excused: number }>> = {};
      for (const r of records) {
        // Roster-marked rows (no account yet) carry the grade from the roster entry.
        const grade = r.student?.gradeLevel ?? r.roster?.gradeLevel;
        if (!grade) continue;
        const key = r.date.toISOString().slice(0, 10);
        if (!gradeDayStatus[grade]) gradeDayStatus[grade] = new Map();
        if (!gradeDayStatus[grade].has(key)) {
          gradeDayStatus[grade].set(key, { present: 0, late: 0, excused: 0 });
        }
        const cell = gradeDayStatus[grade].get(key)!;
        if (r.status === "present") cell.present++;
        else if (r.status === "late") cell.late++;
        else if (r.status === "excused") cell.excused++;
      }

      const grades = GRADE_ORDER.map((grade) => {
        const statusMap = gradeDayStatus[grade] ?? new Map<string, { present: number; late: number; excused: number }>();
        const total = enrolledByGrade[grade] ?? 0;
        return {
          grade: GRADE_LABEL[grade],
          enrolled: total,
          days: dayKeys.map((key) => {
            const cell = statusMap.get(key) ?? { present: 0, late: 0, excused: 0 };
            // Absent = enrolled − (present + late + excused); never negative.
            const accounted = cell.present + cell.late + cell.excused;
            const absent = Math.max(0, total - accounted);
            const d = new Date(key + "T00:00:00Z");
            const date = d.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            });
            return { date, present: cell.present, late: cell.late, absent, excused: cell.excused, total };
          }),
        };
      });

      res.json({ session, status: statusFilter, grades });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/summary",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const session: "AM" | "PM" | undefined =
        req.query.session === "AM" || req.query.session === "PM"
          ? (req.query.session as "AM" | "PM")
          : undefined;

      const activeTerm = await scopedTermRow(req);
      const termId = activeTerm?.id;
      // Real-time date axis: the last 5 school days (Mon–Fri) ending today
      // (Manila day). Anchored to the current date so the panel always shows
      // today even when no attendance record has been submitted yet.
      const today = new Date(phTodayKey() + "T00:00:00Z");
      const dayKeys: string[] = [];
      for (let d = new Date(today); dayKeys.length < 5; d.setUTCDate(d.getUTCDate() - 1)) {
        const wd = d.getUTCDay();
        if (wd !== 0 && wd !== 6) dayKeys.push(d.toISOString().slice(0, 10));
      }
      dayKeys.reverse();

      const where = {
        ...(termId ? { termId } : {}),
        ...(session ? { session } : {}),
        date: { gte: new Date(dayKeys[0] + "T00:00:00Z") },
      };

      const records = await prisma.attendanceRecord.findMany({
        where,
        select: {
          date: true,
          status: true,
          student: { select: { gradeLevel: true } },
          roster: { select: { gradeLevel: true } },
        },
      });

      const byDay = new Map<string, { present: number; total: number }>();
      const gradeDayAgg: Record<string, Map<string, { present: number; total: number }>> = {};
      const gradeTermAgg: Record<string, { present: number; total: number }> = {};
      for (const r of records) {
        const key = r.date.toISOString().slice(0, 10);

        if (!byDay.has(key)) byDay.set(key, { present: 0, total: 0 });
        const agg = byDay.get(key)!;
        agg.total += 1;
        if (r.status === "present") agg.present += 1;

        // Roster-marked rows (no account yet) carry the grade from the roster entry.
        const grade = r.student?.gradeLevel ?? r.roster?.gradeLevel;
        if (!grade) continue;
        if (!gradeDayAgg[grade]) gradeDayAgg[grade] = new Map();
        if (!gradeDayAgg[grade].has(key)) gradeDayAgg[grade].set(key, { present: 0, total: 0 });
        const gAgg = gradeDayAgg[grade].get(key)!;
        gAgg.total += 1;
        if (r.status === "present") gAgg.present += 1;

        if (!gradeTermAgg[grade]) gradeTermAgg[grade] = { present: 0, total: 0 };
        gradeTermAgg[grade].total += 1;
        if (r.status === "present") gradeTermAgg[grade].present += 1;
      }

      const trend = dayKeys.map((key) => {
        const agg = byDay.get(key) ?? { present: 0, total: 0 };
        const d = new Date(key + "T00:00:00Z");
        const day = d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        });
        return { day, present: agg.present, total: agg.total };
      });

      const grades = GRADE_ORDER.filter((g) => gradeTermAgg[g]).map((g) => ({
        grade: GRADE_LABEL[g],
        present: gradeTermAgg[g].present,
        total: gradeTermAgg[g].total,
        days: dayKeys.map((key) => {
          const agg = gradeDayAgg[g]?.get(key) ?? { present: 0, total: 0 };
          const d = new Date(key + "T00:00:00Z");
          const day = d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          });
          return { day, present: agg.present, total: agg.total };
        }),
      }));

      res.json({ session: session ?? "ALL", trend, grades });
    } catch (e) {
      next(e);
    }
  }
);

const GRADE_NUMERIC: Record<string, string> = {
  G7: "7",
  G8: "8",
  G9: "9",
  G10: "10",
  G11: "11",
  G12: "12",
};

// Per-section daily attendance heatblocks for the CURRENT term (calendar).
// Strict per-day basis: a student counts present for a day only when present
// in EVERY subject offered that weekday (late/absent/excused/unrecorded all
// break the day). Covers every school day from the term start date through
// today — previous terms are never mixed in. The `session` param is accepted
// but ignored on the strict path (subject-era takes carry a placeholder
// session); it only applies to the legacy fallback below when a term holds
// zero subject-era rows (e.g. archived AM/PM terms).
router.get(
  "/section-heatmap",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const session: "AM" | "PM" = req.query.session === "PM" ? "PM" : "AM";

      const displayTerm = await resolveDisplayTerm(req);
      const termId = displayTerm?.id;
      if (!termId || !displayTerm) {
        res.json({ session, sections: [] });
        return;
      }

      const sections = await prisma.section.findMany({
        where: schoolYearWhere(req),
        select: {
          id: true,
          name: true,
          gradeLevel: true,
        },
        orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
      });
      // Roster-aware headcount: enlisted students without accounts count too.
      const headcounts = await sectionHeadcounts(sections.map((s) => s.id));
      const enrolledBySection: Record<string, number> = {};
      for (const s of sections) enrolledBySection[s.id] = headcounts.get(s.id) ?? 0;

      // School-day axis: term start -> today, weekends excluded (shared
      // engine). Every block rendered is a school day.
      const dayKeys = buildSchoolDayAxis(displayTerm.startDate);
      const schoolDays = countSchoolDays(dayKeys);

      const sectionIds = sections.map((s) => s.id);
      const subjectTakes = await prisma.attendanceRecord.findMany({
        where: { termId, sectionId: { in: sectionIds }, NOT: { subjectId: null } },
        select: {
          sectionId: true,
          studentId: true,
          rosterId: true,
          subjectId: true,
          date: true,
          status: true,
        },
      });

      if (subjectTakes.length === 0) {
        // Frozen legacy basis (archived AM/PM term): pool raw session takes.
        // Absent is derived (enrolled − present − late − excused).
        const records = await prisma.attendanceRecord.findMany({
          where: { termId, session },
          select: {
            sectionId: true,
            date: true,
            status: true,
          },
        });

        // Aggregation + formatting all come from the generic engine so every
        // attendance surface uses the same date axis, weekend handling, and
        // present/late/excused/absent accounting.
        const dayStatus = groupSectionDay(records);

        const result = sections.map((s) => {
          const statusMap = dayStatus[s.id] ?? new Map();
          const total = enrolledBySection[s.id] ?? 0;
          return {
            sectionId: s.id,
            section: `Grade ${s.name}`,
            gradeLevel: GRADE_NUMERIC[s.gradeLevel] ?? s.gradeLevel,
            enrolled: total,
            days: dayKeys.map((key) => {
              const cell = statusMap.get(key);
              const present = cell?.present ?? 0;
              const late = cell?.late ?? 0;
              const excused = cell?.excused ?? 0;
              const accounted = present + late + excused;
              const absent = Math.max(0, total - accounted);
              return {
                date: formatDateKey(key),
                isoDate: key,
                present,
                late,
                absent,
                excused,
                total,
                isWeekend: isWeekendKey(key),
                // Canonical daily present ratio (present ÷ headcount), 0..100.
                ratio: dailyPresentPercent(present, total),
              };
            }),
          };
        });

        res.json({
          session,
          sections: result,
          schoolDays,
          term: { id: displayTerm.id, termNumber: displayTerm.termNumber },
        });
        return;
      }

      // Strict path: per-student-day outcomes (present > late > excused >
      // absent) so the four buckets are disjoint and always sum to enrolled.
      const entries = await prisma.sectionTimetableEntry.findMany({
        where: {
          sectionId: { in: sectionIds },
          termId,
          status: { in: ["APPROVED", "SUBMITTED"] },
        },
        select: { sectionId: true, subjectId: true, day: true },
      });
      const strict = sectionStrictDays(
        subjectTakes.map((r) => ({
          sectionId: r.sectionId,
          studentKey: r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string),
          subjectId: r.subjectId as string,
          date: r.date,
          status: r.status as AttendanceStatus,
        })),
        buildOfferedMap(entries)
      );

      const result = sections.map((s) => {
        const total = enrolledBySection[s.id] ?? 0;
        const sectionDays = strict.get(s.id);
        return {
          sectionId: s.id,
          section: `Grade ${s.name}`,
          gradeLevel: GRADE_NUMERIC[s.gradeLevel] ?? s.gradeLevel,
          enrolled: total,
          days: dayKeys.map((key) => {
            const cell = sectionDays?.get(key);
            const present = cell?.present.size ?? 0;
            const late = cell?.late.size ?? 0;
            const excused = cell?.excused.size ?? 0;
            const absent = Math.max(0, total - present - late - excused);
            return {
              date: formatDateKey(key),
              isoDate: key,
              present,
              late,
              absent,
              excused,
              total,
              isWeekend: isWeekendKey(key),
              // Canonical daily present ratio (present ÷ headcount), 0..100.
              ratio: dailyPresentPercent(present, total),
            };
          }),
        };
      });

      res.json({
        session,
        sections: result,
        schoolDays,
        term: { id: displayTerm.id, termNumber: displayTerm.termNumber },
      });
    } catch (e) {
      next(e);
    }
  }
);

// Sections for the session's active school year — id, name, and grade level.
// Powers the "Grades & sections" navigation card on the heatmap pages.
router.get(
  "/sections",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const yearId = await scopedYearId(req);
      const where = yearId ? { schoolYearId: yearId } : {};
      const sections = await prisma.section.findMany({
        where,
        select: { id: true, name: true, gradeLevel: true },
        orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
      });
      res.json({
        sections: sections.map((s) => ({
          id: s.id,
          section: `Grade ${s.name}`,
          grade: GRADE_NUMERIC[s.gradeLevel] ?? s.gradeLevel,
        })),
      });
    } catch (e) {
      next(e);
    }
  }
);

// Per-section attendance stats (rate, below-80% days, trend) and the
// school-wide daily attendance trend, for the CURRENT term (calendar) —
// previous terms are never mixed in. Strict per-day basis: a student counts
// present for a day only when present in EVERY subject offered that weekday.
// The `session` param is accepted but ignored on the strict path; it only
// applies to the legacy fallback when a term holds zero subject-era rows.
// amRate/pmRate echo the single daily rate (no session split exists anymore).
router.get(
  "/section-stats",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const session: "AM" | "PM" = req.query.session === "PM" ? "PM" : "AM";
      const selectedSectionId =
        typeof req.query.sectionId === "string" && req.query.sectionId.length > 0
          ? req.query.sectionId
          : undefined;
      const displayTerm = await resolveDisplayTerm(req);
      const termId = displayTerm?.id;
      if (!termId || !displayTerm) {
        res.json({ sections: [], trend: [] });
        return;
      }

      const sections = await prisma.section.findMany({
        where: schoolYearWhere(req),
        select: { id: true, name: true, gradeLevel: true },
        orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
      });
      // Roster-aware headcount: enlisted students without accounts count too.
      const headcounts = await sectionHeadcounts(sections.map((s) => s.id));
      const enrolledBySection: Record<string, number> = {};
      for (const s of sections) enrolledBySection[s.id] = headcounts.get(s.id) ?? 0;
      const totalEnrolled = Object.values(enrolledBySection).reduce((a, b) => a + b, 0);

      // Shared engine: date axis + weekday count from the single source of truth.
      const dayKeys = buildDayAxis(displayTerm.startDate);
      const schoolDays = countSchoolDays(dayKeys);

      const sectionIds = sections.map((s) => s.id);
      const [subjectTakes, entries, profiles, rosterEntries] = await Promise.all([
        prisma.attendanceRecord.findMany({
          where: { termId, sectionId: { in: sectionIds }, NOT: { subjectId: null } },
          select: {
            sectionId: true,
            studentId: true,
            rosterId: true,
            subjectId: true,
            date: true,
            status: true,
          },
        }),
        prisma.sectionTimetableEntry.findMany({
          where: {
            sectionId: { in: sectionIds },
            termId,
            status: { in: ["APPROVED", "SUBMITTED"] },
          },
          select: { sectionId: true, subjectId: true, day: true },
        }),
        prisma.studentProfile.findMany({
          where: { sectionId: { in: sectionIds } },
          select: { userId: true, lrn: true, sectionId: true },
        }),
        prisma.studentRoster.findMany({
          where: { sectionId: { in: sectionIds } },
          select: { id: true, lrn: true, sectionId: true },
        }),
      ]);

      if (subjectTakes.length === 0) {
        // Frozen legacy basis (archived AM/PM term) — original logic unchanged.
        const [raw] = await Promise.all([
          prisma.attendanceRecord.findMany({
            where: { termId, sectionId: { in: sectionIds } },
            select: { sectionId: true, studentId: true, rosterId: true, date: true, session: true, status: true },
          }),
        ]);

        // Below-80% student count per section (selected session): every enrolled
        // key (LRN-deduped, profile wins) with present/schoolDays < 0.8 —
        // students with zero records count as 0%, same as the per-student view.
        const presentByKey = new Map<string, number>();
        for (const r of raw) {
          if (r.session !== session || r.status !== "present") continue;
          const key = r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string);
          presentByKey.set(`${r.sectionId}|${key}`, (presentByKey.get(`${r.sectionId}|${key}`) ?? 0) + 1);
        }
        const atRiskBySection = new Map<string, number>();
        {
          const registeredLrns = new Map<string, Set<string>>(); // sectionId -> lrns
          const keysBySection = new Map<string, string[]>();
          for (const p of profiles) {
            if (!p.sectionId) continue;
            if (!registeredLrns.has(p.sectionId)) registeredLrns.set(p.sectionId, new Set());
            registeredLrns.get(p.sectionId)!.add(p.lrn);
            if (!keysBySection.has(p.sectionId)) keysBySection.set(p.sectionId, []);
            keysBySection.get(p.sectionId)!.push(`${p.sectionId}|${p.userId}`);
          }
          for (const r of rosterEntries) {
            if (!r.sectionId || registeredLrns.get(r.sectionId)?.has(r.lrn)) continue;
            if (!keysBySection.has(r.sectionId)) keysBySection.set(r.sectionId, []);
            keysBySection.get(r.sectionId)!.push(`${r.sectionId}|roster:${r.id}`);
          }
          for (const [sid, keys] of keysBySection) {
            let n = 0;
            for (const k of keys) {
              const rate = schoolDays > 0 ? (presentByKey.get(k) ?? 0) / schoolDays : 0;
              if (rate < 0.8) n++;
            }
            atRiskBySection.set(sid, n);
          }
        }

        // Aggregate all records per section/day, then the selected session's ones.
        const all = groupSectionDay(raw);
        const sessionMap =
          session === "PM"
            ? groupSectionDay(raw.filter((r) => r.session === "PM"))
            : groupSectionDay(raw.filter((r) => r.session === "AM"));

        const result = sections.map((s) => {
          const enrolled = enrolledBySection[s.id] ?? 0;
          const sm = all[s.id];
          const amMap = groupSectionDay(raw.filter((r) => r.sectionId === s.id && r.session === "AM"))[s.id];
          const pmMap = groupSectionDay(raw.filter((r) => r.sectionId === s.id && r.session === "PM"))[s.id];
          const days: DayAgg[] = dayKeys.map((k) => sm?.get(k) ?? { present: 0, late: 0, excused: 0, total: 0 });
          const amDays: DayAgg[] = dayKeys.map((k) => amMap?.get(k) ?? { present: 0, late: 0, excused: 0, total: 0 });
          const pmDays: DayAgg[] = dayKeys.map((k) => pmMap?.get(k) ?? { present: 0, late: 0, excused: 0, total: 0 });

          return {
            sectionId: s.id,
            section: `Grade ${s.name}`,
            gradeLevel: GRADE_NUMERIC[s.gradeLevel] ?? s.gradeLevel,
            enrolled,
            // Canonical attendance % — average present per day ÷ headcount (0..100).
            rate: avgPresentPercent(days, enrolled, schoolDays),
            belowDays: below80Days(days, enrolled),
            amRate: avgPresentPercent(amDays, enrolled, schoolDays),
            pmRate: avgPresentPercent(pmDays, enrolled, schoolDays),
            trend: attendanceTrend(days, enrolled),
            atRiskStudents: atRiskBySection.get(s.id) ?? 0,
          };
        });

        // Daily attendance % trend (present ÷ the relevant headcount, 0..100) for
        // the selected session. Section-wide when a section is selected, otherwise
        // the whole school. Matches the heatblocks' present ÷ headcount ratio.
        const trend: { date: string; rate: number }[] = dayKeys.map((key) => {
          let present = 0;
          const headcount = selectedSectionId
            ? (enrolledBySection[selectedSectionId] ?? 0)
            : totalEnrolled;
          if (selectedSectionId) {
            present = sessionMap[selectedSectionId]?.get(key)?.present ?? 0;
          } else {
            for (const sectionId of Object.keys(sessionMap)) {
              present += sessionMap[sectionId].get(key)?.present ?? 0;
            }
          }
          return {
            date: formatDateKey(key),
            rate: dailyPresentPercent(present, headcount),
          };
        });

        res.json({
          sections: result,
          trend,
          schoolDays,
          totalEnrolled,
          term: { id: displayTerm.id, termNumber: displayTerm.termNumber },
        });
        return;
      }

      // Strict path: per-student-day outcomes over subject-era takes.
      const strict = sectionStrictDays(
        subjectTakes.map((r) => ({
          sectionId: r.sectionId,
          studentKey: r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string),
          subjectId: r.subjectId as string,
          date: r.date,
          status: r.status as AttendanceStatus,
        })),
        buildOfferedMap(entries)
      );

      // Strict present-days per enrolled key (for the at-risk counts below).
      const presentDaysByKey = new Map<string, number>();
      for (const [sectionId, days] of strict) {
        for (const cell of days.values()) {
          for (const key of cell.present) {
            const k = `${sectionId}|${key}`;
            presentDaysByKey.set(k, (presentDaysByKey.get(k) ?? 0) + 1);
          }
        }
      }

      // Below-80% student count per section: every enrolled key (LRN-deduped,
      // profile wins) with strict presentDays/schoolDays < 0.8 — students with
      // zero records count as 0%, same as the per-student view.
      const atRiskBySection = new Map<string, number>();
      {
        const registeredLrns = new Map<string, Set<string>>(); // sectionId -> lrns
        const keysBySection = new Map<string, string[]>();
        for (const p of profiles) {
          if (!p.sectionId) continue;
          if (!registeredLrns.has(p.sectionId)) registeredLrns.set(p.sectionId, new Set());
          registeredLrns.get(p.sectionId)!.add(p.lrn);
          if (!keysBySection.has(p.sectionId)) keysBySection.set(p.sectionId, []);
          keysBySection.get(p.sectionId)!.push(`${p.sectionId}|${p.userId}`);
        }
        for (const r of rosterEntries) {
          if (!r.sectionId || registeredLrns.get(r.sectionId)?.has(r.lrn)) continue;
          if (!keysBySection.has(r.sectionId)) keysBySection.set(r.sectionId, []);
          keysBySection.get(r.sectionId)!.push(`${r.sectionId}|roster:${r.id}`);
        }
        for (const [sid, keys] of keysBySection) {
          let n = 0;
          for (const k of keys) {
            const rate = schoolDays > 0 ? (presentDaysByKey.get(k) ?? 0) / schoolDays : 0;
            if (rate < 0.8) n++;
          }
          atRiskBySection.set(sid, n);
        }
      }

      const result = sections.map((s) => {
        const enrolled = enrolledBySection[s.id] ?? 0;
        const sectionDays = strict.get(s.id);
        // Synthesized day cells: strict present counts; total gates below-80%
        // to days with at least one take (same convention as the legacy path).
        const days: DayAgg[] = dayKeys.map((k) => {
          const cell = sectionDays?.get(k);
          return {
            present: cell?.present.size ?? 0,
            late: 0,
            excused: 0,
            total: (cell?.taken.size ?? 0) > 0 ? enrolled : 0,
          };
        });
        const rate = avgPresentPercent(days, enrolled, schoolDays);

        return {
          sectionId: s.id,
          section: `Grade ${s.name}`,
          gradeLevel: GRADE_NUMERIC[s.gradeLevel] ?? s.gradeLevel,
          enrolled,
          // Canonical attendance % — average strict-present per day ÷ headcount.
          rate,
          belowDays: below80Days(days, enrolled),
          // No session split exists on the strict basis — both echo the rate.
          amRate: rate,
          pmRate: rate,
          trend: attendanceTrend(days, enrolled),
          atRiskStudents: atRiskBySection.get(s.id) ?? 0,
        };
      });

      // Daily strict-present % trend (present ÷ the relevant headcount).
      // Section-wide when a section is selected, otherwise the whole school.
      const trend: { date: string; rate: number }[] = dayKeys.map((key) => {
        let present = 0;
        const headcount = selectedSectionId
          ? (enrolledBySection[selectedSectionId] ?? 0)
          : totalEnrolled;
        if (selectedSectionId) {
          present = strict.get(selectedSectionId)?.get(key)?.present.size ?? 0;
        } else {
          for (const days of strict.values()) {
            present += days.get(key)?.present.size ?? 0;
          }
        }
        return {
          date: formatDateKey(key),
          rate: dailyPresentPercent(present, headcount),
        };
      });

      res.json({
        sections: result,
        trend,
        schoolDays,
        totalEnrolled,
        term: { id: displayTerm.id, termNumber: displayTerm.termNumber },
      });
    } catch (e) {
      next(e);
    }
  }
);

// Students in a section with their attendance for the session's active term.
// Strict per-day basis: present = days present in EVERY offered subject that
// weekday; late/excused/absent are day outcomes on the same basis, so the
// four counts always sum to school days. `session` is accepted but ignored on
// the strict path; it only applies to the legacy fallback when the section
// holds zero subject-era rows for the term.
router.get(
  "/sections/:id/students",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const sectionId = String(req.params.id);
      const session: "AM" | "PM" = req.query.session === "PM" ? "PM" : "AM";
      const activeTerm = await scopedTermRow(req);
      const termId = activeTerm?.id;
      if (!termId) {
        res.json({ sectionId, students: [] });
        return;
      }

      // Total ongoing school days: weekdays (Mon–Fri) from the term start date
      // through today. Same engine as the section stats so the denominators
      // (schoolDays) never disagree between the overview and the roster.
      const totalSchoolDays = countSchoolDays(buildDayAxis(activeTerm?.startDate));

      const section = await prisma.section.findUnique({
        where: { id: sectionId },
        select: { id: true, name: true, gradeLevel: true },
      });
      if (!section) {
        throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
      }

      const subjectTakes = await prisma.attendanceRecord.findMany({
        where: { sectionId, termId, NOT: { subjectId: null } },
        select: {
          studentId: true,
          rosterId: true,
          subjectId: true,
          date: true,
          status: true,
        },
      });

      if (subjectTakes.length === 0) {
        // Frozen legacy basis (no subject-era rows) — original logic unchanged.
        const [students, rosterEntries] = await Promise.all([
          prisma.studentProfile.findMany({
            where: { sectionId },
            select: {
              userId: true,
              lrn: true,
              user: { select: { fullName: true } },
              attendanceRecords: {
                where: { termId, session },
                select: { status: true },
              },
            },
            orderBy: { user: { fullName: "asc" } },
          }),
          // Enlisted students without accounts — zero-record rows included.
          prisma.studentRoster.findMany({
            where: { sectionId },
            select: {
              id: true,
              lrn: true,
              fullName: true,
              attendanceRecords: {
                where: { termId, session },
                select: { status: true },
              },
            },
            orderBy: { fullName: "asc" },
          }),
        ]);
        const registeredLrns = new Set(students.map((st) => st.lrn));

        const toRow = (
          id: string,
          lrn: string,
          name: string,
          records: { status: string }[],
          hasAccount: boolean,
        ) => {
          const counts = { present: 0, late: 0, absent: 0, excused: 0 };
          for (const r of records) {
            if (r.status === "present") counts.present++;
            else if (r.status === "late") counts.late++;
            else if (r.status === "absent") counts.absent++;
            else if (r.status === "excused") counts.excused++;
          }
          const rate =
            totalSchoolDays > 0
              ? Math.round((counts.present / totalSchoolDays) * 1000) / 10
              : 0;
          return {
            id,
            lrn,
            name,
            present: counts.present,
            late: counts.late,
            absent: counts.absent,
            excused: counts.excused,
            rate,
            hasAccount,
          };
        };

        const result = [
          ...students.map((st) =>
            toRow(st.userId, st.lrn, st.user.fullName, st.attendanceRecords, true),
          ),
          ...rosterEntries
            .filter((r) => !registeredLrns.has(r.lrn))
            .map((r) => toRow(`roster:${r.id}`, r.lrn, r.fullName, r.attendanceRecords, false)),
        ];

        res.json({
          sectionId,
          section: `Grade ${section.name}`,
          gradeLevel: GRADE_NUMERIC[section.gradeLevel] ?? section.gradeLevel,
          schoolDays: totalSchoolDays,
          students: result,
        });
        return;
      }

      // Strict path: day outcomes per enrolled student (LRN-deduped).
      const [entries, students, rosterEntries] = await Promise.all([
        prisma.sectionTimetableEntry.findMany({
          where: {
            sectionId,
            termId,
            status: { in: ["APPROVED", "SUBMITTED"] },
          },
          select: { sectionId: true, subjectId: true, day: true },
        }),
        prisma.studentProfile.findMany({
          where: { sectionId },
          select: {
            userId: true,
            lrn: true,
            user: { select: { fullName: true } },
          },
          orderBy: { user: { fullName: "asc" } },
        }),
        prisma.studentRoster.findMany({
          where: { sectionId },
          select: { id: true, lrn: true, fullName: true },
          orderBy: { fullName: "asc" },
        }),
      ]);

      const strict = sectionStrictDays(
        subjectTakes.map((r) => ({
          sectionId,
          studentKey: r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string),
          subjectId: r.subjectId as string,
          date: r.date,
          status: r.status as AttendanceStatus,
        })),
        buildOfferedMap(entries)
      );

      type Enrolled = {
        key: string;
        id: string;
        lrn: string;
        name: string;
        hasAccount: boolean;
      };
      const enrolled: Enrolled[] = [];
      const seenLrn = new Set<string>();
      for (const st of students) {
        seenLrn.add(st.lrn);
        enrolled.push({
          key: st.userId,
          id: st.userId,
          lrn: st.lrn,
          name: st.user.fullName,
          hasAccount: true,
        });
      }
      for (const r of rosterEntries) {
        if (seenLrn.has(r.lrn)) continue; // registered profile wins
        enrolled.push({
          key: `roster:${r.id}`,
          id: `roster:${r.id}`,
          lrn: r.lrn,
          name: r.fullName,
          hasAccount: false,
        });
      }

      // Weekday axis only — weekend days never classify anyone absent.
      const outcomeKeys = buildDayAxis(activeTerm?.startDate).filter(
        (k) => !isWeekendKey(k)
      );
      const outcomes = studentDayOutcomes(
        strict.get(sectionId),
        enrolled.map((e) => e.key),
        outcomeKeys
      );
      const days = outcomeKeys.length;

      const result = enrolled.map((e) => {
        const o = outcomes.get(e.key) ?? { present: 0, late: 0, excused: 0, absent: 0 };
        const rate =
          days > 0 ? Math.round((o.present / days) * 1000) / 10 : 0;
        return {
          id: e.id,
          lrn: e.lrn,
          name: e.name,
          present: o.present,
          late: o.late,
          absent: o.absent,
          excused: o.excused,
          rate,
          hasAccount: e.hasAccount,
        };
      });

      res.json({
        sectionId,
        section: `Grade ${section.name}`,
        gradeLevel: GRADE_NUMERIC[section.gradeLevel] ?? section.gradeLevel,
        schoolDays: days,
        students: result,
      });
    } catch (e) {
      next(e);
    }
  }
);

// School-wide AM/PM attendance pattern for the session's active term: overall AM/PM
// present rate plus the average present rate per weekday. Powers the "Patterns"
// overlay on the risk heatmaps index. Derived from real attendance records.
router.get(
  "/session-pattern",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const activeTerm = await scopedTermRow(req);
      const termId = activeTerm?.id;
      if (!termId) {
        res.json({ amRate: 0, pmRate: 0, byDay: [] });
        return;
      }

      const start = activeTerm?.startDate
        ? new Date(activeTerm.startDate.toISOString().slice(0, 10) + "T00:00:00Z")
        : null;
      const today = new Date(phTodayKey() + "T00:00:00Z");
      const axisStart = start ?? today;
      const dayKeys: string[] = [];
      for (let d = new Date(axisStart); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
        dayKeys.push(d.toISOString().slice(0, 10));
      }

      const sections = await prisma.section.findMany({
        where: schoolYearWhere(req),
        select: { id: true },
      });
      // Roster-aware headcount: enlisted students without accounts count too.
      const headcounts = await sectionHeadcounts(sections.map((s) => s.id));
      const enrolledBySection: Record<string, number> = {};
      for (const s of sections) enrolledBySection[s.id] = headcounts.get(s.id) ?? 0;
      const totalEnrolled = Object.values(enrolledBySection).reduce((a, b) => a + b, 0);

      const records = await prisma.attendanceRecord.findMany({
        where: { termId },
        select: { sectionId: true, date: true, session: true, status: true },
      });

      type Cell = { present: number; total: number };
      const am: Record<string, Cell> = {};
      const pm: Record<string, Cell> = {};
      const byWeekday: Record<number, { present: number; total: number }> = {};
      for (const r of records) {
        const key = r.date.toISOString().slice(0, 10);
        const target = r.session === "AM" ? am : r.session === "PM" ? pm : null;
        if (target) {
          if (!target[key]) target[key] = { present: 0, total: 0 };
          target[key].total += 1;
          if (r.status === "present") target[key].present += 1;
        }
        const wd = new Date(key + "T00:00:00Z").getUTCDay();
        if (wd === 0 || wd === 6) continue;
        if (!byWeekday[wd]) byWeekday[wd] = { present: 0, total: 0 };
        byWeekday[wd].total += 1;
        if (r.status === "present") byWeekday[wd].present += 1;
      }

      const expected = totalEnrolled * dayKeys.length;
      const amPresent = Object.values(am).reduce((a, c) => a + c.present, 0);
      const pmPresent = Object.values(pm).reduce((a, c) => a + c.present, 0);
      const amRate = expected > 0 ? Math.round((amPresent / expected) * 1000) / 10 : 0;
      const pmRate = expected > 0 ? Math.round((pmPresent / expected) * 1000) / 10 : 0;

      const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];
      const byDay = DAY_NAMES.map((day, i) => {
        const wd = i + 1;
        const cell = byWeekday[wd] ?? { present: 0, total: 0 };
        return {
          day,
          rate: cell.total > 0 ? Math.round((cell.present / cell.total) * 1000) / 10 : 0,
        };
      });

      res.json({ amRate, pmRate, byDay });
    } catch (e) {
      next(e);
    }
  }
);

// Every student under 80% of current (display-term) attendance, school-wide.
// Strict per-day basis: present = days present in EVERY offered subject that
// weekday (late/absent/excused/unrecorded break the day). Flat worst-first
// list for the Needs Attention tab. Zero-record students count as 0%.
// `session` is accepted but ignored on the strict path; it only applies to
// the legacy fallback when the term holds zero subject-era rows.
router.get(
  "/at-risk-students",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const session: "AM" | "PM" = req.query.session === "PM" ? "PM" : "AM";
      const displayTerm = await resolveDisplayTerm(req);
      if (!displayTerm) {
        res.json({ students: [], schoolDays: 0 });
        return;
      }
      const termId = displayTerm.id;
      const schoolDays = countSchoolDays(buildDayAxis(displayTerm.startDate));

      const [sections, profiles, rosterEntries] = await Promise.all([
        prisma.section.findMany({
          where: schoolYearWhere(req),
          select: { id: true, name: true, gradeLevel: true },
        }),
        prisma.studentProfile.findMany({
          select: {
            userId: true,
            lrn: true,
            sectionId: true,
            user: { select: { fullName: true } },
          },
        }),
        prisma.studentRoster.findMany({
          select: { id: true, lrn: true, fullName: true, sectionId: true },
        }),
      ]);
      const meta = new Map(sections.map((s) => [s.id, s]));
      const sectionIds = sections.map((s) => s.id);

      const subjectTakes = await prisma.attendanceRecord.findMany({
        where: { termId, sectionId: { in: sectionIds }, NOT: { subjectId: null } },
        select: {
          sectionId: true,
          studentId: true,
          rosterId: true,
          subjectId: true,
          date: true,
          status: true,
        },
      });

      if (subjectTakes.length === 0) {
        // Frozen legacy basis (archived AM/PM term) — original logic unchanged.
        const records = await prisma.attendanceRecord.findMany({
          where: { termId, session },
          select: { sectionId: true, studentId: true, rosterId: true, status: true },
        });

        type Agg = { present: number; late: number; absent: number; excused: number };
        const agg = new Map<string, Agg>();
        for (const r of records) {
          if (!meta.has(r.sectionId)) continue;
          const key = r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string);
          if (!agg.has(key)) agg.set(key, { present: 0, late: 0, absent: 0, excused: 0 });
          const cell = agg.get(key)!;
          if (r.status === "present") cell.present++;
          else if (r.status === "late") cell.late++;
          else if (r.status === "absent") cell.absent++;
          else if (r.status === "excused") cell.excused++;
        }

        // Enrollment, LRN-deduped (registered profile wins over roster entry).
        type Enrolled = { key: string; lrn: string; name: string; sectionId: string; hasAccount: boolean };
        const bySectionLrn = new Map<string, Enrolled>();
        for (const p of profiles) {
          if (!p.sectionId || !meta.has(p.sectionId)) continue;
          bySectionLrn.set(`${p.sectionId}|${p.lrn}`, {
            key: p.userId,
            lrn: p.lrn,
            name: p.user.fullName,
            sectionId: p.sectionId,
            hasAccount: true,
          });
        }
        for (const r of rosterEntries) {
          if (!r.sectionId || !meta.has(r.sectionId)) continue;
          const k = `${r.sectionId}|${r.lrn}`;
          if (bySectionLrn.has(k)) continue;
          bySectionLrn.set(k, {
            key: `roster:${r.id}`,
            lrn: r.lrn,
            name: r.fullName,
            sectionId: r.sectionId,
            hasAccount: false,
          });
        }

        const students = [...bySectionLrn.values()]
          .map((e) => {
            const c = agg.get(e.key) ?? { present: 0, late: 0, absent: 0, excused: 0 };
            const rate =
              schoolDays > 0 ? Math.round((c.present / schoolDays) * 1000) / 10 : 0;
            const sec = meta.get(e.sectionId)!;
            return {
              id: e.key,
              lrn: e.lrn,
              name: e.name,
              sectionId: e.sectionId,
              section: `Grade ${sec.name}`,
              gradeLevel: GRADE_NUMERIC[sec.gradeLevel] ?? sec.gradeLevel,
              present: c.present,
              late: c.late,
              absent: c.absent,
              excused: c.excused,
              rate,
              hasAccount: e.hasAccount,
            };
          })
          .filter((s) => s.rate < 80)
          .sort((a, b) => a.rate - b.rate);

        res.json({
          students,
          schoolDays,
          term: { id: displayTerm.id, termNumber: displayTerm.termNumber },
        });
        return;
      }

      // Strict path: day outcomes per enrolled student (LRN-deduped).
      const entries = await prisma.sectionTimetableEntry.findMany({
        where: {
          sectionId: { in: sectionIds },
          termId,
          status: { in: ["APPROVED", "SUBMITTED"] },
        },
        select: { sectionId: true, subjectId: true, day: true },
      });
      const strict = sectionStrictDays(
        subjectTakes.map((r) => ({
          sectionId: r.sectionId,
          studentKey: r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string),
          subjectId: r.subjectId as string,
          date: r.date,
          status: r.status as AttendanceStatus,
        })),
        buildOfferedMap(entries)
      );

      // Weekday axis only — weekend days never classify anyone absent.
      const outcomeKeys = buildDayAxis(displayTerm.startDate).filter(
        (k) => !isWeekendKey(k)
      );
      const days = outcomeKeys.length;

      type Enrolled = { key: string; lrn: string; name: string; sectionId: string; hasAccount: boolean };
      const bySectionLrn = new Map<string, Enrolled>();
      for (const p of profiles) {
        if (!p.sectionId || !meta.has(p.sectionId)) continue;
        bySectionLrn.set(`${p.sectionId}|${p.lrn}`, {
          key: p.userId,
          lrn: p.lrn,
          name: p.user.fullName,
          sectionId: p.sectionId,
          hasAccount: true,
        });
      }
      for (const r of rosterEntries) {
        if (!r.sectionId || !meta.has(r.sectionId)) continue;
        const k = `${r.sectionId}|${r.lrn}`;
        if (bySectionLrn.has(k)) continue;
        bySectionLrn.set(k, {
          key: `roster:${r.id}`,
          lrn: r.lrn,
          name: r.fullName,
          sectionId: r.sectionId,
          hasAccount: false,
        });
      }

      // Group enrolled keys per section for the outcome pass.
      const keysBySection = new Map<string, string[]>();
      for (const e of bySectionLrn.values()) {
        if (!keysBySection.has(e.sectionId)) keysBySection.set(e.sectionId, []);
        keysBySection.get(e.sectionId)!.push(e.key);
      }
      const outcomeByKey = new Map<
        string,
        { present: number; late: number; excused: number; absent: number }
      >();
      for (const [sectionId, keys] of keysBySection) {
        const out = studentDayOutcomes(strict.get(sectionId), keys, outcomeKeys);
        for (const [key, row] of out) outcomeByKey.set(`${sectionId}|${key}`, row);
      }

      const students = [...bySectionLrn.values()]
        .map((e) => {
          const o = outcomeByKey.get(`${e.sectionId}|${e.key}`) ?? {
            present: 0,
            late: 0,
            excused: 0,
            absent: 0,
          };
          const rate = days > 0 ? Math.round((o.present / days) * 1000) / 10 : 0;
          const sec = meta.get(e.sectionId)!;
          return {
            id: e.key,
            lrn: e.lrn,
            name: e.name,
            sectionId: e.sectionId,
            section: `Grade ${sec.name}`,
            gradeLevel: GRADE_NUMERIC[sec.gradeLevel] ?? sec.gradeLevel,
            present: o.present,
            late: o.late,
            absent: o.absent,
            excused: o.excused,
            rate,
            hasAccount: e.hasAccount,
          };
        })
        .filter((s) => s.rate < 80)
        .sort((a, b) => a.rate - b.rate);

      res.json({
        students,
        schoolDays: days,
        term: { id: displayTerm.id, termNumber: displayTerm.termNumber },
      });
      return;
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/students/:id/attendance-rate",
  requireAuth,
  async (req, res, next) => {
    try {
      const termId = typeof req.query.termId === "string" ? req.query.termId : undefined;
      if (!termId) throw new AppError(400, "MISSING_TERM", "termId query required");
      const rate = await computeAttendanceRate(String(req.params.id), termId);
      res.json(rate);
    } catch (e) { next(e); }
  }
);

// Per-subject rate for one student (+ daily view derived from subject marks).
// :id accepts a profile uuid or `roster:<uuid>`. Omit ?subjectId= for the
// pooled overall rate across all subjects.
router.get(
  "/students/:id/subject-rate",
  requireAuth,
  async (req, res, next) => {
    try {
      const termId = typeof req.query.termId === "string" ? req.query.termId : undefined;
      if (!termId) throw new AppError(400, "MISSING_TERM", "termId query required");
      const subjectId =
        typeof req.query.subjectId === "string" && req.query.subjectId.length > 0
          ? req.query.subjectId
          : undefined;
      const rawId = String(req.params.id);
      const who = rawId.startsWith("roster:")
        ? { rosterId: rawId.slice("roster:".length) }
        : { studentId: rawId };
      const rate = await computeSubjectAttendanceRate(who, termId, subjectId);
      res.json(rate);
    } catch (e) { next(e); }
  }
);

// Offered subjects for a section+term (assignment-backed) with the caller's
// mark permission. Powers the teacher subject selector — the ONLY source of
// valid subjectId values for POST /bulk.
router.get(
  "/subjects",
  requireAuth,
  requireRole("principal", "adviser", "subject_teacher", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const sectionId = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
      if (!sectionId) throw new AppError(400, "MISSING_SECTION", "sectionId query required");
      const teacherId = req.user!.id;
      const callerRole = req.user!.role;

      // Default to the session's active term — the client always sends it.
      let termId = typeof req.query.termId === "string" ? req.query.termId : undefined;
      if (!termId) {
        termId = req.termScope?.termId ?? (await scopedTermRow(req))?.id;
      }
      if (!termId) {
        res.json({ subjects: [] });
        return;
      }

      const offerings = await prisma.teacherSubjectAssignment.findMany({
        where: { sectionId, termId },
        include: {
          subject: { select: { id: true, name: true, code: true, gradeLevel: true } },
          teacher: { select: { fullName: true } },
        },
        orderBy: { subject: { name: "asc" } },
      });

      let advisoryOk = false;
      if (callerRole === "adviser" || callerRole === "principal") {
        if (callerRole === "principal") {
          advisoryOk = true;
        } else {
          try {
            const sections = await adviserSectionsOr404(teacherId);
            advisoryOk = sections.some((s) => s.id === sectionId);
          } catch {
            advisoryOk = false;
          }
        }
      }

      // Committed timetable subjects attached to the caller's linked
      // teacher-list code — one batched read, so claimed subject teachers
      // can mark their own classes without assignment rows.
      const linkedSubjectIds =
        callerRole !== "adviser" && callerRole !== "principal"
          ? new Set(
              (
                await prisma.sectionTimetableEntry.findMany({
                  where: {
                    sectionId,
                    termId,
                    status: { in: ["APPROVED", "SUBMITTED"] },
                    teacherName: { userId: teacherId },
                  },
                  select: { subjectId: true },
                  distinct: ["subjectId"],
                })
              ).map((e) => e.subjectId)
            )
          : new Set<string>();
      const seen = new Map<string, (typeof offerings)[number]>();
      for (const o of offerings) {
        if (!seen.has(o.subjectId)) seen.set(o.subjectId, o);
      }
      res.json({
        sectionId,
        termId,
        subjects: [...seen.values()].map((o) => ({
          assignmentId: o.id,
          subjectId: o.subject.id,
          code: o.subject.code,
          name: o.subject.name,
          gradeLevel: o.subject.gradeLevel,
          teacherId: o.teacherId,
          teacherName: o.teacher.fullName,
          canMark:
            callerRole === "principal"
              ? false
              : callerRole === "adviser"
                ? advisoryOk
                : o.teacherId === teacherId || linkedSubjectIds.has(o.subjectId),
        })),
      });
    } catch (e) { next(e); }
  }
);

// Sheet roster for one section (active term): registered profiles plus
// enlisted-but-unregistered roster rows (LRN-deduped), each with a live
// attendance rate. Authorized for every section the caller may take
// attendance for — advisory, assignments, and code-linked timetable slots —
// so claimed subject teachers resolve their section's students.
router.get(
  "/section-roster",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const sectionId = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
      if (!sectionId) throw new AppError(400, "MISSING_SECTION", "sectionId query required");
      const termId = req.termScope?.termId ?? (await scopedTermRow(req))?.id;
      if (!termId) {
        throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
      }
      const allowed = await teachableSectionIds(
        teacherId,
        termId,
        req.termScope?.schoolYearId ?? null
      );
      if (!allowed.includes(sectionId)) {
        throw new AppError(403, "FORBIDDEN", "Section is not in your teaching load");
      }
      const section = await prisma.section.findUnique({
        where: { id: sectionId },
        select: { id: true, name: true },
      });
      if (!section) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
      const [profiles, rosterRows] = await Promise.all([
        prisma.studentProfile.findMany({
          where: { sectionId },
          select: {
            userId: true,
            lrn: true,
            user: { select: { fullName: true } },
            attendanceRecords: { where: { termId }, select: { status: true } },
          },
          orderBy: { user: { fullName: "asc" } },
        }),
        prisma.studentRoster.findMany({
          where: { sectionId },
          select: { id: true, lrn: true, fullName: true },
          orderBy: { fullName: "asc" },
        }),
      ]);
      const registeredLrns = new Set(profiles.map((p) => p.lrn));
      const students = [
        ...profiles.map((p) => {
          const present = p.attendanceRecords.filter((r) => r.status === "present").length;
          const total = p.attendanceRecords.length;
          return {
            studentId: p.userId,
            name: p.user.fullName,
            lrn: p.lrn,
            attendanceRate: total === 0 ? 1 : present / total,
          };
        }),
        ...rosterRows
          .filter((r) => !registeredLrns.has(r.lrn))
          .map((r) => ({ studentId: `roster:${r.id}`, name: r.fullName, lrn: r.lrn, attendanceRate: 1 })),
      ];
      // Alphabetical by surname (last token), tie-broken by full name.
      const surnameOf = (name: string) => {
        const parts = name.trim().split(/\s+/);
        return (parts[parts.length - 1] ?? "").toLowerCase();
      };
      students.sort(
        (a, b) => surnameOf(a.name).localeCompare(surnameOf(b.name)) || a.name.localeCompare(b.name),
      );
      // Roster-only attendance rates need their own rows (profiles came with
      // theirs above).
      if (rosterRows.length > 0) {
        const rosterAtt = await prisma.attendanceRecord.findMany({
          where: { rosterId: { in: rosterRows.map((r) => r.id) }, termId },
          select: { rosterId: true, status: true },
        });
        const byRoster = new Map<string, { present: number; total: number }>();
        for (const a of rosterAtt) {
          const cell = byRoster.get(a.rosterId as string) ?? { present: 0, total: 0 };
          cell.total += 1;
          if (a.status === "present") cell.present += 1;
          byRoster.set(a.rosterId as string, cell);
        }
        for (const s of students) {
          if (!s.studentId.startsWith("roster:")) continue;
          const cell = byRoster.get(s.studentId.slice("roster:".length));
          if (cell && cell.total > 0) s.attendanceRate = cell.present / cell.total;
        }
      }
      res.json({ sectionId: section.id, sectionName: section.name, termId, students });
    } catch (e) {
      next(e);
    }
  }
);

// Per-student, per-day subject marks for the active term plus the term
// range — feeds the meetup blocks view (one heatblock per scheduled meetup
// day of the subject, term-scoped). Authorized for every section the caller
// may serve (advisory, assignments, code-linked timetable slots).
// ?mine=1 restricts rows to takes the caller recorded themselves, so a
// teacher's workspace rate matches what the advisory matrix attributes.
router.get(
  "/subject-days",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const sectionId = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
      const subjectId = typeof req.query.subjectId === "string" ? req.query.subjectId : undefined;
      if (!sectionId) throw new AppError(400, "MISSING_SECTION", "sectionId query required");
      if (!subjectId) throw new AppError(400, "MISSING_SUBJECT", "subjectId query required");
      const mineOnly = req.query.mine === "1";
      const termId = req.termScope?.termId ?? (await scopedTermRow(req))?.id;
      if (!termId) {
        throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
      }
      const allowed = await teachableSectionIds(
        teacherId,
        termId,
        req.termScope?.schoolYearId ?? null
      );
      if (!allowed.includes(sectionId)) {
        throw new AppError(403, "FORBIDDEN", "Section is not in your teaching load");
      }
      const [term, records] = await Promise.all([
        prisma.term.findUnique({
          where: { id: termId },
          select: { startDate: true, endDate: true },
        }),
        prisma.attendanceRecord.findMany({
          where: {
            sectionId,
            subjectId,
            termId,
            ...(mineOnly ? { recordedBy: teacherId } : {}),
          },
          select: { studentId: true, rosterId: true, date: true, status: true, slot: true },
          orderBy: { date: "asc" },
        }),
      ]);
      res.json({
        sectionId,
        subjectId,
        termId,
        mineOnly,
        termStart: term?.startDate ? term.startDate.toISOString() : null,
        termEnd: term?.endDate ? term.endDate.toISOString() : null,
        records: records.map((r) => ({
          key: r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string),
          date: r.date.toISOString().slice(0, 10),
          status: r.status,
        })),
      });
    } catch (e) {
      next(e);
    }
  }
);

// Per-student attendance summary for one section (active term, all
// subjects): present/late/absent/excused counts plus the present rate.
// Authorized for every section the caller may serve — feeds the advisory
// attendance table.
router.get(
  "/section-summary",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const sectionId = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
      if (!sectionId) throw new AppError(400, "MISSING_SECTION", "sectionId query required");
      const termId = req.termScope?.termId ?? (await scopedTermRow(req))?.id;
      if (!termId) {
        throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
      }
      const allowed = await teachableSectionIds(
        teacherId,
        termId,
        req.termScope?.schoolYearId ?? null
      );
      if (!allowed.includes(sectionId)) {
        throw new AppError(403, "FORBIDDEN", "Section is not in your teaching load");
      }
      const section = await prisma.section.findUnique({
        where: { id: sectionId },
        select: { id: true, name: true },
      });
      if (!section) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
      const [profiles, rosterRows, records] = await Promise.all([
        prisma.studentProfile.findMany({
          where: { sectionId },
          select: { userId: true, lrn: true, user: { select: { fullName: true } } },
          orderBy: { user: { fullName: "asc" } },
        }),
        prisma.studentRoster.findMany({
          where: { sectionId },
          select: { id: true, lrn: true, fullName: true },
          orderBy: { fullName: "asc" },
        }),
        prisma.attendanceRecord.findMany({
          where: { sectionId, termId, NOT: { subjectId: null } },
          select: { studentId: true, rosterId: true, subjectId: true, status: true },
        }),
      ]);
      const registeredLrns = new Set(profiles.map((p) => p.lrn));
      type Agg = { present: number; late: number; absent: number; excused: number };
      const byKey = new Map<string, Agg>();
      const bump = (key: string, status: string) => {
        const cell = byKey.get(key) ?? { present: 0, late: 0, absent: 0, excused: 0 };
        if (status === "present") cell.present += 1;
        else if (status === "late") cell.late += 1;
        else if (status === "absent") cell.absent += 1;
        else if (status === "excused") cell.excused += 1;
        byKey.set(key, cell);
      };
      for (const r of records) {
        bump(r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string), r.status);
      }
      const students = [
        ...profiles.map((p) => {
          const agg = byKey.get(p.userId) ?? { present: 0, late: 0, absent: 0, excused: 0 };
          const total = agg.present + agg.late + agg.absent + agg.excused;
          return {
            studentId: p.userId,
            name: p.user.fullName,
            lrn: p.lrn,
            ...agg,
            total,
            rate: total === 0 ? 1 : agg.present / total,
          };
        }),
        ...rosterRows
          .filter((r) => !registeredLrns.has(r.lrn))
          .map((r) => {
            const agg = byKey.get(`roster:${r.id}`) ?? { present: 0, late: 0, absent: 0, excused: 0 };
            const total = agg.present + agg.late + agg.absent + agg.excused;
            return {
              studentId: `roster:${r.id}`,
              name: r.fullName,
              lrn: r.lrn,
              ...agg,
              total,
              rate: total === 0 ? 1 : agg.present / total,
            };
          }),
      ];
      const surnameOf = (name: string) => {
        const parts = name.trim().split(/\s+/);
        return (parts[parts.length - 1] ?? "").toLowerCase();
      };
      students.sort(
        (a, b) => surnameOf(a.name).localeCompare(surnameOf(b.name)) || a.name.localeCompare(b.name),
      );
      res.json({ sectionId: section.id, sectionName: section.name, termId, students });
    } catch (e) {
      next(e);
    }
  }
);

// Per-student, per-subject present rates for one section (active term).
// Read-only matrix for advisory views: each student maps to one rate per
// subject (null when the subject has no records for them yet).
router.get(
  "/section-subject-matrix",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const sectionId = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
      if (!sectionId) throw new AppError(400, "MISSING_SECTION", "sectionId query required");
      const termId = req.termScope?.termId ?? (await scopedTermRow(req))?.id;
      if (!termId) {
        throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
      }
      const allowed = await teachableSectionIds(
        teacherId,
        termId,
        req.termScope?.schoolYearId ?? null
      );
      if (!allowed.includes(sectionId)) {
        throw new AppError(403, "FORBIDDEN", "Section is not in your teaching load");
      }
      const section = await prisma.section.findUnique({
        where: { id: sectionId },
        select: { id: true, name: true },
      });
      if (!section) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
      const [profiles, rosterRows, records, timetabled, offered] = await Promise.all([
        prisma.studentProfile.findMany({
          where: { sectionId },
          select: { userId: true, lrn: true, user: { select: { fullName: true } } },
          orderBy: { user: { fullName: "asc" } },
        }),
        prisma.studentRoster.findMany({
          where: { sectionId },
          select: { id: true, lrn: true, fullName: true },
          orderBy: { fullName: "asc" },
        }),
        prisma.attendanceRecord.findMany({
          where: { sectionId, termId, NOT: { subjectId: null } },
          select: { studentId: true, rosterId: true, subjectId: true, status: true, date: true, slot: true },
        }),
        prisma.sectionTimetableEntry.findMany({
          where: { sectionId, termId, status: { in: ["APPROVED", "SUBMITTED"] } },
          select: {
            subjectId: true,
            day: true,
            subject: { select: { id: true, name: true, code: true } },
            teacherName: { select: { userId: true } },
          },
        }),
        // Every subject offered in this section + term, so the matrix
        // covers the full advisory load — not just scheduled/recorded ones.
        prisma.teacherSubjectAssignment.findMany({
          where: { sectionId, termId },
          select: { subject: { select: { id: true, name: true, code: true } } },
          distinct: ["subjectId"],
        }),
      ]);
      const registeredLrns = new Set(profiles.map((p) => p.lrn));
      const subjects = new Map<string, { id: string; name: string; code: string }>();
      for (const o of offered) subjects.set(o.subject.id, o.subject);
      for (const t of timetabled) subjects.set(t.subject.id, t.subject);
      // Subjects with records but no timetable row still get a column.
      const subjectIds = await prisma.subject.findMany({
        where: { id: { in: [...new Set(records.map((r) => r.subjectId as string))] } },
        select: { id: true, name: true, code: true },
      });
      for (const s of subjectIds) {
        if (!subjects.has(s.id)) subjects.set(s.id, s);
      }
      // Rate = present ÷ elapsed meetups. Elapsed meetups come from the
      // subject's committed timetable slots (weekdays × term start → today);
      // a done meetup with no take counts as absent, so "no record" never
      // renders — only a percentage. Presents dated outside the term window
      // are ignored on both sides, keeping the rate within 0–100%.
      const meetupBySubject = new Map<string, number[]>();
      for (const t of timetabled) {
        const arr = meetupBySubject.get(t.subjectId) ?? [];
        if (!arr.includes(t.day)) arr.push(t.day);
        meetupBySubject.set(t.subjectId, arr);
      }
      const term = await prisma.term.findUnique({
        where: { id: termId },
        select: { startDate: true, endDate: true },
      });
      const startStr = term?.startDate?.toISOString().slice(0, 10) ?? null;
      const todayStr = new Date().toISOString().slice(0, 10);
      const endStr = (() => {
        if (!term?.endDate) return todayStr;
        const termEnd = term.endDate.toISOString().slice(0, 10);
        return termEnd < todayStr ? termEnd : todayStr;
      })();
      const elapsedDatesBySubject = new Map<string, Set<string>>();
      if (startStr && startStr <= endStr) {
        for (const sid of subjects.keys()) {
          const days = meetupBySubject.get(sid) ?? [1, 2, 3, 4, 5];
          const set = new Set<string>();
          for (
            let d = new Date(`${startStr}T00:00:00Z`);
            d.toISOString().slice(0, 10) <= endStr;
            d = new Date(d.getTime() + 86_400_000)
          ) {
            const dow = d.getUTCDay();
            const day = dow === 0 ? 7 : dow;
            if (days.includes(day)) set.add(d.toISOString().slice(0, 10));
          }
          elapsedDatesBySubject.set(sid, set);
        }
      }
      const presentDatesByStudentSubject = new Map<string, Set<string>>();
      const recordedDatesBySubject = new Map<string, Set<string>>();
      for (const r of records) {
        const subjectId = r.subjectId as string;
        const dateStr = r.date.toISOString().slice(0, 10);
        // Every subject teacher's workspace takes count — the adviser
        // oversees records from all of them, not just the slot owner.
        const studentKey = r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string);
        let recorded = recordedDatesBySubject.get(subjectId);
        if (!recorded) {
          recorded = new Set();
          recordedDatesBySubject.set(subjectId, recorded);
        }
        recorded.add(dateStr);
        if (r.status === "present") {
          const key = `${studentKey}|${subjectId}`;
          let present = presentDatesByStudentSubject.get(key);
          if (!present) {
            present = new Set();
            presentDatesByStudentSubject.set(key, present);
          }
          present.add(dateStr);
        }
      }
      const rateOf = (studentKey: string, subjectId: string) => {
        const elapsed = elapsedDatesBySubject.get(subjectId);
        const present = presentDatesByStudentSubject.get(`${studentKey}|${subjectId}`);
        if (elapsed && elapsed.size > 0) {
          let n = 0;
          for (const d of present ?? []) if (elapsed.has(d)) n += 1;
          return n / elapsed.size;
        }
        // Term hasn't started — fall back to recorded sessions so a number
        // still renders instead of "no record".
        const recorded = recordedDatesBySubject.get(subjectId)?.size ?? 0;
        if (recorded === 0) return 0;
        let n = 0;
        for (const d of present ?? []) {
          if (recordedDatesBySubject.get(subjectId)?.has(d)) n += 1;
        }
        return n / recorded;
      };
      const students = [
        ...profiles.map((p) => ({ studentId: p.userId, name: p.user.fullName, lrn: p.lrn })),
        ...rosterRows
          .filter((r) => !registeredLrns.has(r.lrn))
          .map((r) => ({ studentId: `roster:${r.id}`, name: r.fullName, lrn: r.lrn })),
      ];
      const surnameOf = (name: string) => {
        const parts = name.trim().split(/\s+/);
        return (parts[parts.length - 1] ?? "").toLowerCase();
      };
      students.sort(
        (a, b) => surnameOf(a.name).localeCompare(surnameOf(b.name)) || a.name.localeCompare(b.name),
      );
      res.json({
        sectionId: section.id,
        sectionName: section.name,
        termId,
        subjects: [...subjects.values()].sort((a, b) => a.name.localeCompare(b.name)),
        students: students.map((s) => ({
          studentId: s.studentId,
          name: s.name,
          lrn: s.lrn,
          rates: Object.fromEntries(
            [...subjects.keys()].map((sid) => [sid, rateOf(s.studentId, sid)]),
          ) as Record<string, number | null>,
        })),
      });
    } catch (e) {
      next(e);
    }
  }
);

// Per-subject present rates for a section (active term). Replaces the AM/PM
// `session-pattern` comparison for subject-era data: one card per offered
// subject instead of two AM/PM bars.
router.get(
  "/subject-pattern",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const sectionId = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
      const activeTerm = await scopedTermRow(req);
      const termId = activeTerm?.id;
      if (!termId) {
        res.json({ subjects: [] });
        return;
      }
      const records = await prisma.attendanceRecord.findMany({
        where: {
          termId,
          ...(sectionId ? { sectionId } : {}),
          NOT: { subjectId: null },
        },
        select: { subjectId: true, status: true, date: true },
      });
      const subjectIds = [...new Set(records.map((r) => r.subjectId as string))];
      const subjects = subjectIds.length
        ? await prisma.subject.findMany({
            where: { id: { in: subjectIds } },
            select: { id: true, name: true, code: true },
          })
        : [];
      const nameOf = new Map(subjects.map((s) => [s.id, s]));
      const grouped = groupSubjectDay(records);
      res.json({
        termId,
        sectionId: sectionId ?? null,
        subjects: [...grouped.entries()].map(([sid, days]) => {
          let present = 0;
          let total = 0;
          for (const cell of days.values()) {
            present += cell.present;
            total += cell.total;
          }
          return {
            subjectId: sid,
            code: nameOf.get(sid)?.code ?? sid,
            name: nameOf.get(sid)?.name ?? sid,
            present,
            total,
            rate: total > 0 ? Math.round((present / total) * 1000) / 10 : 0,
          };
        }),
      });
    } catch (e) { next(e); }
  }
);

// Per-section, per-day, per-subject heatblocks for the CURRENT term
// (calendar) — previous terms are never mixed in. Each section card renders
// one row per offered subject and one block per day, colored by the canonical
// present ratio (present ÷ headcount). Only subject-era rows (subjectId
// non-null) feed this surface — legacy AM/PM rows stay on the session
// heatmap + archive reads.
router.get(
  "/section-subject-heatmap",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const subjectFilter =
        typeof req.query.subjectId === "string" && req.query.subjectId.length > 0
          ? req.query.subjectId
          : undefined;
      const displayTerm = await resolveDisplayTerm(req);
      const termId = displayTerm?.id;
      if (!termId || !displayTerm) {
        res.json({ sections: [], subjects: [], schoolDays: 0 });
        return;
      }

      const sections = await prisma.section.findMany({
        where: schoolYearWhere(req),
        select: { id: true, name: true, gradeLevel: true },
        orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
      });
      const headcounts = await sectionHeadcounts(sections.map((s) => s.id));
      // School-day axis: term start -> today, weekends excluded. Every block
      // rendered is a school day.
      const dayKeys = buildSchoolDayAxis(displayTerm.startDate);
      const schoolDays = countSchoolDays(dayKeys);

      const [records, offerings] = await Promise.all([
        prisma.attendanceRecord.findMany({
          where: {
            termId,
            NOT: { subjectId: null },
            ...(subjectFilter ? { subjectId: subjectFilter } : {}),
          },
          select: { sectionId: true, subjectId: true, date: true, status: true },
        }),
        prisma.teacherSubjectAssignment.findMany({
          where: {
            termId,
            ...(subjectFilter ? { subjectId: subjectFilter } : {}),
          },
          select: {
            sectionId: true,
            subjectId: true,
            subject: { select: { id: true, name: true, code: true } },
          },
        }),
      ]);

      const subjectMeta = new Map<string, { subjectId: string; code: string; name: string }>();
      for (const o of offerings) {
        if (!subjectMeta.has(o.subjectId)) {
          subjectMeta.set(o.subjectId, {
            subjectId: o.subject.id,
            code: o.subject.code,
            name: o.subject.name,
          });
        }
      }
      // Subjects seen in records but missing an assignment row (e.g. legacy
      // imports) still render — code falls back to the id prefix.
      for (const r of records) {
        const sid = r.subjectId as string;
        if (!subjectMeta.has(sid)) {
          subjectMeta.set(sid, { subjectId: sid, code: sid.slice(0, 8), name: sid });
        }
      }

      // Offered subjects per section (assignment-backed), plus any subject
      // with records in that section so nothing recorded is ever hidden.
      const offeredBySection = new Map<string, string[]>();
      for (const o of offerings) {
        const arr = offeredBySection.get(o.sectionId) ?? [];
        if (!arr.includes(o.subjectId)) arr.push(o.subjectId);
        offeredBySection.set(o.sectionId, arr);
      }
      for (const r of records) {
        const arr = offeredBySection.get(r.sectionId) ?? [];
        const sid = r.subjectId as string;
        if (!arr.includes(sid)) arr.push(sid);
        offeredBySection.set(r.sectionId, arr);
      }
      const byCode = (a: string, b: string) =>
        (subjectMeta.get(a)?.code ?? a).localeCompare(subjectMeta.get(b)?.code ?? b);
      for (const arr of offeredBySection.values()) arr.sort(byCode);

      // Aggregate: section -> day -> subject -> counts.
      type Cell = { present: number; late: number; excused: number; total: number };
      const agg = new Map<string, Map<string, Map<string, Cell>>>();
      for (const r of records) {
        const day = r.date.toISOString().slice(0, 10);
        const sid = r.subjectId as string;
        if (!agg.has(r.sectionId)) agg.set(r.sectionId, new Map());
        const days = agg.get(r.sectionId)!;
        if (!days.has(day)) days.set(day, new Map());
        const subs = days.get(day)!;
        if (!subs.has(sid)) subs.set(sid, { present: 0, late: 0, excused: 0, total: 0 });
        const cell = subs.get(sid)!;
        cell.total += 1;
        if (r.status === "present") cell.present++;
        else if (r.status === "late") cell.late++;
        else if (r.status === "excused") cell.excused++;
      }

      const result = sections.map((s) => {
        const enrolled = headcounts.get(s.id) ?? 0;
        const subjectIds = subjectFilter
          ? (offeredBySection.get(s.id) ?? []).filter((id) => id === subjectFilter)
          : (offeredBySection.get(s.id) ?? []);
        const sectionAgg = agg.get(s.id);
        return {
          sectionId: s.id,
          section: `Grade ${s.name}`,
          gradeLevel: GRADE_NUMERIC[s.gradeLevel] ?? s.gradeLevel,
          enrolled,
          subjects: subjectIds.map((id) => subjectMeta.get(id)!),
          days: dayKeys.map((key) => {
            const subs = sectionAgg?.get(key);
            return {
              date: formatDateKey(key),
              isoDate: key,
              isWeekend: isWeekendKey(key),
              cells: subjectIds.map((sid) => {
                const c = subs?.get(sid) ?? { present: 0, late: 0, excused: 0, total: 0 };
                const absent = Math.max(0, enrolled - (c.present + c.late + c.excused));
                return {
                  subjectId: sid,
                  present: c.present,
                  late: c.late,
                  absent,
                  excused: c.excused,
                  total: c.total,
                  ratio: dailyPresentPercent(c.present, enrolled),
                };
              }),
            };
          }),
        };
      });

      res.json({
        sections: result,
        subjects: [...subjectMeta.values()].sort((a, b) => a.code.localeCompare(b.code)),
        schoolDays,
        term: { id: displayTerm.id, termNumber: displayTerm.termNumber },
      });
    } catch (e) {
      next(e);
    }
  }
);

// Frozen AM/PM archive reads (AttendanceRecordLegacy — never written by the
// app). Keeps historical dashboards working after the subject cutover without
// inventing subject information.
router.get(
  "/legacy/days",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const sectionId = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
      const session: "AM" | "PM" = req.query.session === "PM" ? "PM" : "AM";
      const limit = Math.min(
        Math.max(typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) || 30 : 30, 1),
        200
      );
      const rows = await prisma.attendanceRecordLegacy.findMany({
        where: { ...(sectionId ? { sectionId } : {}), session },
        orderBy: { date: "desc" },
        take: limit,
        select: { id: true, studentId: true, rosterId: true, sectionId: true, date: true, session: true, status: true, termId: true },
      });
      res.json({ session, sectionId: sectionId ?? null, source: "legacy", rows });
    } catch (e) { next(e); }
  }
);

export default router;
