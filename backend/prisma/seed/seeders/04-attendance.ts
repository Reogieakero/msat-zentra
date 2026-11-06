import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { SUBJECTS_PER_DAY, ATTENDANCE_DAYS_PER_TERM, T2_CUTOFF, DRY } from "../config.js";
import type { CoreCtx } from "./00-core.js";
import type { AcademicCtx } from "./01-academic.js";
import type { RosterCtx } from "./02-roster.js";
import type { Rng } from "../utils/rng.js";
import { schoolDaysBetween, toMidnightUTC } from "../utils/calendar.js";
import { Batcher } from "../utils/chunk.js";

export interface AttendanceCtx {
  presentCount: Map<string, { present: number; total: number }>; // studentKey -> per term? key `${termId}|${studentKey}`
}

export async function seedAttendance(
  prisma: PrismaClient,
  core: CoreCtx,
  acad: AcademicCtx,
  roster: RosterCtx,
  rng: Rng,
): Promise<AttendanceCtx> {
  const presentCount = new Map<string, { present: number; total: number }>();
  if (DRY) return { presentCount };

  const t1 = core.termIds.find((t) => t.n === 1)!;
  const t2 = core.termIds.find((t) => t.n === 2)!;
  const t1DaysAll = schoolDaysBetween(t1.start, t1.end);
  const t2DaysAll = schoolDaysBetween(t2.start, t2.end, T2_CUTOFF);
  // Small seeds keep only the most recent N days per term (keeps rates realistic).
  const t1Days = t1DaysAll.slice(-ATTENDANCE_DAYS_PER_TERM);
  const t2Days = t2DaysAll.slice(-ATTENDANCE_DAYS_PER_TERM);
  console.log(`Attendance days: T1=${t1Days.length} T2partial=${t2Days.length}`);

  // Subjects per grade for daily sampling.
  const subjByGrade = new Map<string, { id: string }[]>();
  for (const s of acad.subjects) {
    const a = subjByGrade.get(s.gradeLevel) ?? [];
    a.push(s);
    subjByGrade.set(s.gradeLevel, a);
  }
  // Roster by section for bulk locality.
  const rosterBySection = new Map<string, typeof roster.rosterAll>();
  for (const r of roster.rosterAll) {
    const a = rosterBySection.get(r.sectionId) ?? [];
    a.push(r);
    rosterBySection.set(r.sectionId, a);
  }
  const userIdByLrn = new Map(roster.profiles.map((p) => [p.lrn, p.userId]));

  const batcher = new Batcher("Attendance", 3000, (ch) => prisma.attendanceRecord.createMany({ data: ch }) as any);

  const terms: { termId: string; days: Date[] }[] = [
    { termId: core.t1Id, days: t1Days },
    { termId: core.t2Id, days: t2Days },
  ];

  for (const { termId, days } of terms) {
    for (const sec of acad.sections) {
      const students = rosterBySection.get(sec.id) ?? [];
      if (!students.length) continue;
      const pool = subjByGrade.get(sec.gradeLevel) ?? [];
      if (!pool.length) continue;
      // Rotate daily subjects deterministically per section+day.
      for (let di = 0; di < days.length; di++) {
        const date = toMidnightUTC(days[di]);
        const shuffled = [...pool].sort((a, b) => {
          const ha = (a.id.charCodeAt(0) + di + sec.name.length) % 97;
          const hb = (b.id.charCodeAt(0) + di + sec.name.length) % 97;
          return ha - hb;
        });
        const daySubs = shuffled.slice(0, SUBJECTS_PER_DAY);
        for (const subj of daySubs) {
          const assignId = acad.assignByKey.get(`${subj.id}|${sec.id}|${termId}`);
          if (!assignId) continue;
          // Recorded by assignment owner (lookup).
          const assign = acad.assignments.find((a) => a.id === assignId);
          const recordedBy = assign?.teacherId ?? sec.adviserId;
          for (const r of students) {
            const ab = roster.rosterAbility.get(r.id) ?? { ability: 0.7, attendRate: 0.92 };
            const p = ab.attendRate;
            const roll = rng.next();
            let status: "present" | "absent" | "late" | "excused";
            if (roll < p) status = "present";
            else if (roll < p + 0.03) status = "late";
            else if (roll < p + 0.045) status = "excused";
            else status = "absent";
            const studentUserId = userIdByLrn.get(r.lrn);
            const row: any = {
              sectionId: sec.id,
              date,
              session: "AM" as const,
              status,
              recordedBy,
              termId,
              subjectId: subj.id,
              assignmentId: assignId,
              slot: 1,
            };
            if (studentUserId) row.studentId = studentUserId;
            else row.rosterId = r.id;
            await batcher.push(row);

            const skey = studentUserId ? `S:${studentUserId}` : `R:${r.id}`;
            const ck = `${termId}|${skey}`;
            let c = presentCount.get(ck);
            if (!c) {
              c = { present: 0, total: 0 };
              presentCount.set(ck, c);
            }
            c.total += 1;
            if (status === "present") c.present += 1;

            // 2% double-period second slot same day/subject.
            if (rng.next() < 0.02) {
              const row2: any = { ...row, slot: 2, status: rng.next() < 0.97 ? status : "late" };
              await batcher.push(row2);
              c.total += 1;
              if (row2.status === "present") c.present += 1;
            }
          }
        }
        // Flush per day per section to bound memory (batcher auto-flushes at 3000).
      }
    }
  }
  await batcher.finish();
  return { presentCount };
}
