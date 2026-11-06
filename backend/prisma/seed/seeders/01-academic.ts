import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import argon2 from "argon2";
import { SUBJECTS, SECTION_PLAN, STAFF_PASSWORD, DRY, SIZE } from "../config.js";
import type { CoreCtx } from "./00-core.js";
import type { Rng } from "../utils/rng.js";
import { keyId } from "../utils/rng.js";
import { bulkCreate } from "../utils/chunk.js";

export interface AcademicCtx {
  sections: { id: string; name: string; gradeLevel: string; adviserId: string }[];
  subjects: { id: string; code: string; gradeLevel: string; name: string }[];
  subjByKey: Map<string, { id: string; code: string; gradeLevel: string }>;
  sectionById: Map<string, { id: string; name: string; gradeLevel: string; adviserId: string }>;
  assignments: { id: string; teacherId: string; subjectId: string; sectionId: string; termId: string }[];
  assignByKey: Map<string, string>; // subject|section|term -> assignmentId
  advisers: { id: string; email: string }[];
  subjectTeachers: { id: string; email: string }[];
  allTeachers: { id: string }[];
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export async function seedAcademic(prisma: PrismaClient, core: CoreCtx, rng: Rng): Promise<AcademicCtx> {
  // ---- subjects ----
  if (!DRY) {
    for (const [grade, list] of Object.entries(SUBJECTS)) {
      for (const s of list) {
        await prisma.subject.upsert({
          where: { code_gradeLevel: { code: s.code, gradeLevel: grade as any } },
          update: { name: s.name },
          create: { name: s.name, code: s.code, gradeLevel: grade as any },
        });
      }
    }
  }
  const subjectsRaw = await prisma.subject.findMany({ select: { id: true, code: true, gradeLevel: true, name: true } });
  const subjects = subjectsRaw.filter((s) => SUBJECTS[s.gradeLevel]?.some((x) => x.code === s.code));
  const subjByKey = new Map(subjects.map((s) => [`${s.gradeLevel}:${s.code}`, s]));

  // ---- advisers + subject teachers ----
  const staffHash = DRY ? "dry" : await argon2.hash(STAFF_PASSWORD);
  const advisers: { id: string; email: string }[] = [];
  const subjectTeachers: { id: string; email: string }[] = [];

  // Ensure 30 subject teachers (full) / 8 (small) — deterministic emails.
  const teacherTarget = SIZE === "full" ? 30 : 8;
  if (!DRY) {
    for (let i = 1; i <= teacherTarget; i++) {
      const email = `subject.teacher${i}@zentra.test`;
      const u = await prisma.user.upsert({
        where: { email },
        update: { fullName: `Subject Teacher ${i}`, role: "subject_teacher", passwordHash: staffHash, status: "active" },
        create: { email, fullName: `Subject Teacher ${i}`, role: "subject_teacher", passwordHash: staffHash, status: "active" },
      });
      await prisma.staffProfile.upsert({
        where: { userId: u.id },
        update: { isAdviser: false },
        create: { userId: u.id, employeeId: `TCH${String(i).padStart(3, "0")}`, isAdviser: false, department: "Academic", handledGradeLevels: [] },
      });
    }
  }
  const stRows = await prisma.user.findMany({ where: { email: { startsWith: "subject.teacher" } }, select: { id: true, email: true } });
  for (const r of stRows) subjectTeachers.push(r);
  // Legacy single teacher.subject account -> include if present.
  const legacy = await prisma.user.findMany({ where: { role: "subject_teacher" }, select: { id: true, email: true } });
  for (const r of legacy) if (!subjectTeachers.some((t) => t.id === r.id)) subjectTeachers.push(r);

  // ---- sections (52 full / 18 small: 3 per grade x 20) ----
  let sections: { id: string; name: string; gradeLevel: string; adviserId: string }[] = [];
  if (!DRY) {
    let advN = 0;
    for (const [grade, plan] of Object.entries(SECTION_PLAN)) {
      for (let k = 0; k < plan.count; k++) {
        const letter = LETTERS[k];
        const name = `${grade}-${letter}`;
        const email = `adviser.${grade.toLowerCase()}.${letter.toLowerCase()}@zentra.test`;
        const adv = await prisma.user.upsert({
          where: { email },
          update: { fullName: `Adviser ${name}`, role: "adviser", passwordHash: staffHash, status: "active" },
          create: { email, fullName: `Adviser ${name}`, role: "adviser", passwordHash: staffHash, status: "active" },
        });
        await prisma.staffProfile.upsert({
          where: { userId: adv.id },
          update: { isAdviser: true },
          create: {
            userId: adv.id,
            employeeId: `ADV${grade}${letter}${advN++}`,
            isAdviser: true,
            department: "Academic",
            handledGradeLevels: [grade as any],
            // 10% of JHS advisers are master teachers.
            isMasterTeacher: ["G7", "G8", "G9", "G10"].includes(grade) && rng.next() < 0.1,
          },
        });
        advisers.push({ id: adv.id, email });
        const secId = keyId("sec", `${core.syId}_${name}`);
        await prisma.section.upsert({
          where: { id: secId },
          update: { name, gradeLevel: grade as any, schoolYearId: core.syId, adviserId: adv.id, adviserLabel: `Adviser ${name}`, adviserCode: null },
          create: { id: secId, name, gradeLevel: grade as any, schoolYearId: core.syId, adviserId: adv.id, adviserLabel: `Adviser ${name}` },
        });
      }
    }
  }
  const secRows = await prisma.section.findMany({ where: { schoolYearId: core.syId }, select: { id: true, name: true, gradeLevel: true, adviserId: true } });
  sections = secRows.filter((s) => s.adviserId).map((s) => ({ ...s, adviserId: s.adviserId as string }));
  // Fill advisers list from DB when dry-run.
  if (DRY || !advisers.length) {
    const advRows = await prisma.user.findMany({ where: { role: "adviser" }, select: { id: true, email: true } });
    advisers.push(...advRows);
  }
  const sectionById = new Map(sections.map((s) => [s.id, s]));

  // ---- TeacherName catalog (one per teacher display name) ----
  if (!DRY) {
    const catalogNames = [...advisers.map((a) => a.email), ...subjectTeachers.map((t) => t.email)];
    const rows: any[] = [];
    let ci = 0;
    for (const email of catalogNames) {
      const u = await prisma.user.findUnique({ where: { email }, select: { id: true, fullName: true } });
      if (!u) continue;
      ci++;
      rows.push({ id: keyId("tname", email), name: u.fullName, code: `MS-${String(ci).padStart(3, "0")}`, userId: u.id });
    }
    // Upsert one-by-one (unique name/code) — only ~82 rows.
    for (const r of rows) {
      await prisma.teacherName.upsert({ where: { id: r.id }, update: { name: r.name, code: r.code, userId: r.userId }, create: r }).catch(async () => {
        await prisma.teacherName.upsert({ where: { name: r.name }, update: { code: r.code, userId: r.userId }, create: r }).catch(() => {});
      });
    }
  }

  // ---- ScheduleConfig per term ----
  if (!DRY) {
    for (const t of core.termIds) {
      await prisma.scheduleConfig.upsert({ where: { termId: t.id }, update: {}, create: { termId: t.id } });
    }
  }

  // ---- Timetable (APPROVED, 5 days x 6 periods) ----
  const tnameRows = await prisma.teacherName.findMany({ select: { id: true } });
  if (!DRY) {
    const rows: any[] = [];
    for (const term of [core.t1Id, core.t2Id]) {
      for (const sec of sections) {
        const pool = subjects.filter((s) => s.gradeLevel === sec.gradeLevel);
        if (!pool.length) continue;
        for (let day = 1; day <= 5; day++) {
          for (let period = 0; period < 6; period++) {
            const subj = pool[(day + period + sec.name.charCodeAt(sec.name.length - 1)) % pool.length];
            rows.push({
              id: keyId("tte", `${sec.name}_${term.slice(-4)}_${day}_${period}`),
              sectionId: sec.id,
              subjectId: subj.id,
              termId: term,
              day,
              period,
              teacherNameId: tnameRows.length ? tnameRows[(day + period) % tnameRows.length].id : null,
              status: "APPROVED" as const,
              submittedBy: sec.adviserId,
              submittedAt: new Date("2026-06-01T00:00:00Z"),
              reviewedBy: core.principalId,
              reviewedAt: new Date("2026-06-05T00:00:00Z"),
            });
          }
        }
      }
    }
    await bulkCreate("Timetable", rows.length, (ch) => prisma.sectionTimetableEntry.createMany({ data: ch, skipDuplicates: true }) as any, rows, 1000);
  }

  // ---- TeacherSubjectAssignment (every subject x section x T1/T2) ----
  const assignments: { id: string; teacherId: string; subjectId: string; sectionId: string; termId: string }[] = [];
  const assignByKey = new Map<string, string>();
  if (!DRY) {
    const rows: any[] = [];
    const pool = [...advisers.map((a) => a.id), ...subjectTeachers.map((t) => t.id)];
    let oi = 0;
    for (const term of [core.t1Id, core.t2Id]) {
      for (const sec of sections) {
        const subs = subjects.filter((s) => s.gradeLevel === sec.gradeLevel);
        subs.forEach((subj, si) => {
          // Adviser owns ~60% of their section subjects; rest round-robin subject teachers.
          const teacherId = (si + sec.name.length) % 5 < 3 ? sec.adviserId : subjectTeachers[(oi++) % Math.max(1, subjectTeachers.length)]?.id ?? sec.adviserId;
          const id = keyId("tsa", `${subj.code}_${sec.name}_${term.slice(-4)}`);
          rows.push({ id, teacherId, subjectId: subj.id, sectionId: sec.id, termId: term });
          void pool;
        });
      }
    }
    await bulkCreate("Assignments", rows.length, (ch) => prisma.teacherSubjectAssignment.createMany({ data: ch, skipDuplicates: true }) as any, rows, 1000);
  }
  const assignRows = await prisma.teacherSubjectAssignment.findMany({
    where: { termId: { in: [core.t1Id, core.t2Id] } },
    select: { id: true, teacherId: true, subjectId: true, sectionId: true, termId: true },
  });
  for (const a of assignRows) {
    assignments.push(a);
    assignByKey.set(`${a.subjectId}|${a.sectionId}|${a.termId}`, a.id);
  }

  // ---- TeacherTermGrant (every teacher x T1/T2) ----
  if (!DRY) {
    const allT = [...advisers.map((a) => a.id), ...subjectTeachers.map((t) => t.id)];
    const rows: any[] = [];
    for (const uid of allT) {
      for (const term of [core.t1Id, core.t2Id]) {
        rows.push({ id: keyId("ttg", `${uid.slice(-6)}_${term.slice(-4)}`), userId: uid, termId: term, via: rng.next() < 0.5 ? "adviser" : "code", attendanceVerifiedAt: new Date("2026-06-10T00:00:00Z") });
      }
    }
    await bulkCreate("TermGrants", rows.length, (ch) => prisma.teacherTermGrant.createMany({ data: ch, skipDuplicates: true }) as any, rows, 1000);
  }

  const allTeachers = [...advisers.map((a) => ({ id: a.id })), ...subjectTeachers.map((t) => ({ id: t.id }))];
  console.log(`Academic: sections=${sections.length} subjects=${subjects.length} assignments=${assignments.length}`);
  return { sections, subjects, subjByKey, sectionById, assignments, assignByKey, advisers, subjectTeachers, allTeachers };
}
