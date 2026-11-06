import "dotenv/config";
import argon2 from "argon2";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";
import { keyId } from "./seed/utils/rng.js";
import { bulkCreate } from "./seed/utils/chunk.js";
import { buildNamesForGenders } from "./data/filipino-names.js";
import { STAFF_PASSWORD } from "./seed/config.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });
const DRY = process.argv.includes("--dry-run");
const SY_NAME = "SY 2026-2027";
const DAYS = [1, 2, 3, 4, 5];
const PERIODS = [0, 1, 2, 3, 4, 5, 6, 7]; // 8 periods/day

const SECTION_NAMES = [
  "Einstein", "Newton", "Curie", "Tesla", "Darwin", "Galileo",
  "Edison", "Franklin", "Mendel", "Pasteur", "Archimedes", "Aristotle", "Reogie",
];

// 9 subjects/grade: 8 CORE + 1 ELECTIVE.
const SUBJECTS: Record<string, { name: string; code: string; cat: "CORE" | "ELECTIVE" }[]> = {
  G7: [
    { name: "Mathematics 7", code: "MATH7", cat: "CORE" },
    { name: "English 7", code: "ENG7", cat: "CORE" },
    { name: "Science 7", code: "SCI7", cat: "CORE" },
    { name: "Filipino 7", code: "FIL7", cat: "CORE" },
    { name: "Araling Panlipunan 7", code: "AP7", cat: "CORE" },
    { name: "Edukasyon sa Pagpapakatao 7", code: "ESP7", cat: "CORE" },
    { name: "MAPEH 7", code: "MAPEH7", cat: "CORE" },
    { name: "TLE 7", code: "TLE7", cat: "CORE" },
    { name: "ICT 7", code: "ICT7", cat: "ELECTIVE" },
  ],
  G8: [
    { name: "Mathematics 8", code: "MATH8", cat: "CORE" },
    { name: "English 8", code: "ENG8", cat: "CORE" },
    { name: "Science 8", code: "SCI8", cat: "CORE" },
    { name: "Filipino 8", code: "FIL8", cat: "CORE" },
    { name: "Araling Panlipunan 8", code: "AP8", cat: "CORE" },
    { name: "Edukasyon sa Pagpapakatao 8", code: "ESP8", cat: "CORE" },
    { name: "MAPEH 8", code: "MAPEH8", cat: "CORE" },
    { name: "TLE 8", code: "TLE8", cat: "CORE" },
    { name: "ICT 8", code: "ICT8", cat: "ELECTIVE" },
  ],
  G9: [
    { name: "Mathematics 9", code: "MATH9", cat: "CORE" },
    { name: "English 9", code: "ENG9", cat: "CORE" },
    { name: "Science 9", code: "SCI9", cat: "CORE" },
    { name: "Filipino 9", code: "FIL9", cat: "CORE" },
    { name: "Araling Panlipunan 9", code: "AP9", cat: "CORE" },
    { name: "Edukasyon sa Pagpapakatao 9", code: "ESP9", cat: "CORE" },
    { name: "MAPEH 9", code: "MAPEH9", cat: "CORE" },
    { name: "TLE 9", code: "TLE9", cat: "CORE" },
    { name: "ICT 9", code: "ICT9", cat: "ELECTIVE" },
  ],
  G10: [
    { name: "Mathematics 10", code: "MATH10", cat: "CORE" },
    { name: "English 10", code: "ENG10", cat: "CORE" },
    { name: "Science 10", code: "SCI10", cat: "CORE" },
    { name: "Filipino 10", code: "FIL10", cat: "CORE" },
    { name: "Araling Panlipunan 10", code: "AP10", cat: "CORE" },
    { name: "Edukasyon sa Pagpapakatao 10", code: "ESP10", cat: "CORE" },
    { name: "MAPEH 10", code: "MAPEH10", cat: "CORE" },
    { name: "TLE 10", code: "TLE10", cat: "CORE" },
    { name: "ICT 10", code: "ICT10", cat: "ELECTIVE" },
  ],
  G11: [
    { name: "General Mathematics 11", code: "GMM11", cat: "CORE" },
    { name: "Purposive Communication 11", code: "PC11", cat: "CORE" },
    { name: "Earth Science 11", code: "ES11", cat: "CORE" },
    { name: "Komunikasyon 11", code: "FIL11", cat: "CORE" },
    { name: "PE and Health 11", code: "PEH11", cat: "CORE" },
    { name: "Practical Research 1", code: "PR111", cat: "CORE" },
    { name: "Statistics and Probability 11", code: "STAT11", cat: "CORE" },
    { name: "Understanding Culture, Society and Politics 11", code: "UCSP11", cat: "CORE" },
    { name: "ICT 11", code: "ICT11", cat: "ELECTIVE" },
  ],
  G12: [
    { name: "Basic Calculus 12", code: "CALC12", cat: "CORE" },
    { name: "Practical Research 2", code: "RES12", cat: "CORE" },
    { name: "Physics 12", code: "PHY12", cat: "CORE" },
    { name: "Filipino 12", code: "FIL12", cat: "CORE" },
    { name: "Contemporary Arts 12", code: "ARTS12", cat: "CORE" },
    { name: "Entrepreneurship 12", code: "ENTREP12", cat: "CORE" },
    { name: "English for Academic and Professional Purposes 12", code: "EAPP12", cat: "CORE" },
    { name: "PE and Health 12", code: "PEH12", cat: "CORE" },
    { name: "ICT 12", code: "ICT12", cat: "ELECTIVE" },
  ],
};

const GRADES = ["G7", "G8", "G9", "G10", "G11", "G12"];

async function main() {
  const sy = await prisma.schoolYear.findFirst({ where: { name: SY_NAME }, select: { id: true } });
  if (!sy) throw new Error(`School year "${SY_NAME}" not found`);
  const terms = await prisma.term.findMany({ where: { schoolYearId: sy.id }, orderBy: { termNumber: "asc" } });
  const t1 = terms.find((t) => t.termNumber === 1);
  const t2 = terms.find((t) => t.termNumber === 2);
  if (!t1 || !t2) throw new Error("T1/T2 missing");
  const termIds = [t1.id, t2.id];
  console.log(`Scope: ${SY_NAME} T1=${t1.id.slice(0, 8)} T2=${t2.id.slice(0, 8)} DRY=${DRY}`);

  // ---- 1. Subjects (54: 9/grade) ----
  if (!DRY) {
    for (const [grade, list] of Object.entries(SUBJECTS)) {
      for (const s of list) {
        await prisma.subject.upsert({
          where: { code_gradeLevel: { code: s.code, gradeLevel: grade as never } },
          update: { name: s.name, category: s.cat as never },
          create: { name: s.name, code: s.code, gradeLevel: grade as never, category: s.cat as never },
        });
      }
    }
  }
  const subjects = await prisma.subject.findMany({ select: { id: true, code: true, gradeLevel: true } });
  const byGrade = new Map<string, { id: string; code: string }[]>();
  for (const [grade, list] of Object.entries(SUBJECTS)) {
    const rows = list.map((s) => {
      const hit = subjects.find((r) => r.code === s.code && r.gradeLevel === grade);
      if (!hit) {
        if (DRY) return { id: `(dry:${grade}:${s.code})`, code: s.code };
        throw new Error(`Subject missing after upsert: ${grade}:${s.code}`);
      }
      return hit;
    }).sort((a, b) => a.code.localeCompare(b.code));
    byGrade.set(grade, rows);
  }
  console.log(`Subjects: ${subjects.filter((s) => Object.values(SUBJECTS).some((l) => l.some((x) => x.code === s.code))).length} (9/grade)`);

  // ---- 2. ScheduleConfig T1/T2 ----
  if (!DRY) {
    for (const t of termIds) await prisma.scheduleConfig.upsert({ where: { termId: t }, update: {}, create: { termId: t } });
  }

  // ---- 3. Sections (13) ----
  const secs = await prisma.section.findMany({ where: { name: { in: SECTION_NAMES }, schoolYearId: sy.id }, select: { id: true, name: true, gradeLevel: true } });
  const missing = SECTION_NAMES.filter((n) => !secs.some((s) => s.name === n));
  if (missing.length) throw new Error(`Sections missing in ${SY_NAME}: ${missing.join(", ")}`);
  console.log(`Sections: ${secs.length}`);
  const secIds = secs.map((s) => s.id);

  // ---- 4a. Existing assignments (also feeds the invariant pre-check) ----
  const existing = await prisma.teacherSubjectAssignment.findMany({
    where: { sectionId: { in: secIds }, termId: { in: termIds } },
    select: { id: true, teacherId: true, subjectId: true, sectionId: true, termId: true },
    orderBy: { id: "asc" },
  });

  // ---- 4. Dedicated Filipino-named teachers, 2 per grade ----
  // Idempotent: reuse the pair already owning this grade's scope assignments
  // when they fully cover all 9 subjects; otherwise top up with new accounts.
  // Build a larger pool than needed and keep names unused by any existing user
  // (generator is deterministic, so early names may already belong to students).
  const genders: ("Male" | "Female")[] = Array.from({ length: 48 }, (_, i) => (i % 2 === 0 ? "Female" : "Male"));
  const filoPool = buildNamesForGenders(genders);
  const takenNames = new Set((await prisma.user.findMany({ select: { fullName: true } })).map((u) => u.fullName));
  const filoNames = filoPool.filter((n) => !takenNames.has(n));
  let filoIdx = 0;
  const existingTNums = (await prisma.user.findMany({ where: { email: { startsWith: "subject.teacher" } }, select: { email: true } }))
    .map((u) => Number(u.email.match(/subject\.teacher(\d+)@/)?.[1] ?? 0));
  let nextT = Math.max(30, ...existingTNums) + 1;
  const existingEmp = new Set((await prisma.staffProfile.findMany({ select: { employeeId: true } })).map((s) => s.employeeId));
  let nextEmp = 31;
  const nextEmpId = () => {
    while (existingEmp.has(`TCH${String(nextEmp).padStart(3, "0")}`)) nextEmp++;
    const emp = `TCH${String(nextEmp++).padStart(3, "0")}`;
    existingEmp.add(emp);
    return emp;
  };
  const teacherByGrade = new Map<string, { id: string; email: string; fullName: string }[]>();
  const staffHash = DRY ? "dry" : await argon2.hash(STAFF_PASSWORD);
  let teachersCreated = 0;
  const gradeSecIds = new Map(secs.map((s) => [s.id, s.gradeLevel]));
  for (let g = 0; g < GRADES.length; g++) {
    const grade = GRADES[g];
    const gradeSectionIds = secs.filter((s) => s.gradeLevel === grade).map((s) => s.id);
    // Existing owners covering this grade's scope (any term).
    // Existing owners covering this grade's scope (any term). The pair together
    // must own every subject (5 + 4 split) — no single teacher covers all 9.
    const scoped = existing.filter((a) => gradeSecIds.get(a.sectionId) === grade);
    const distinctTeachers = [...new Set(scoped.map((a) => a.teacherId))].sort();
    const unionSubjects = new Set(scoped.map((a) => a.subjectId));
    const need = byGrade.get(grade)!.length;
    const pair: { id: string; email: string; fullName: string }[] = [];
    if (distinctTeachers.length === 2 && unionSubjects.size >= need) {
      // Reuse the owning pair (first-run teachers).
      const rows = await prisma.user.findMany({ where: { id: { in: distinctTeachers } }, select: { id: true, email: true, fullName: true }, orderBy: { email: "asc" } });
      for (const r of rows) pair.push(r);
      console.log(`${grade}: reuse ${pair.map((p) => `${p.fullName} <${p.email}>`).join(" | ")}`);
    } else {
      for (let k = 0; k < 2; k++) {
        const email = `subject.teacher${nextT++}@zentra.test`;
        const fullName = DRY ? filoNames[filoIdx++ % filoNames.length] : filoNames[filoIdx++];
        if (!DRY && filoIdx > filoNames.length) throw new Error("Not enough unused Filipino names in pool");
        if (!DRY) {
          const u = await prisma.user.upsert({
            where: { email },
            update: { fullName, role: "subject_teacher", passwordHash: staffHash, status: "active" },
            create: { email, fullName, role: "subject_teacher", passwordHash: staffHash, status: "active" },
          });
          const emp = nextEmpId();
          await prisma.staffProfile.upsert({
            where: { userId: u.id },
            update: { isAdviser: false, handledGradeLevels: [grade as never] },
            create: { userId: u.id, employeeId: emp, isAdviser: false, department: "Academic", handledGradeLevels: [grade as never] },
          });
          teachersCreated++;
          pair.push({ id: u.id, email, fullName });
        } else {
          const found = await prisma.user.findUnique({ where: { email }, select: { id: true } });
          pair.push({ id: found?.id ?? `(dry:${email})`, email, fullName });
        }
      }
      console.log(`${grade}: ${pair.map((p) => `${p.fullName} <${p.email}>`).join(" | ")}`);
    }
    teacherByGrade.set(grade, pair);
  }

  // ---- 5. Invariant pre-check: one subject = one teacher per section+term ----
  const byKey = new Map<string, typeof existing>();
  for (const a of existing) {
    const k = `${a.subjectId}|${a.sectionId}|${a.termId}`;
    byKey.set(k, [...(byKey.get(k) ?? []), a]);
  }
  const violations = [...byKey.entries()].filter(([, rows]) => new Set(rows.map((r) => r.teacherId)).size > 1);
  for (const [k, rows] of violations) {
    console.log(`VIOLATION (kept, skipped): ${k} teachers=${[...new Set(rows.map((r) => r.teacherId))].join(",")}`);
  }
  const owned = new Map<string, string>(); // subject|section|term -> teacherId (first wins)
  for (const [k, rows] of byKey) owned.set(k, rows[0].teacherId);

  // ---- 6. Assignments: grade pair split 5/4 (one teacher, many subjects) ----
  const assignRows: { id: string; teacherId: string; subjectId: string; sectionId: string; termId: string }[] = [];
  for (const sec of secs) {
    const subs = byGrade.get(sec.gradeLevel)!;
    const [tA, tB] = teacherByGrade.get(sec.gradeLevel)!;
    subs.forEach((subj, i) => {
      const teacherId = i < 5 ? tA.id : tB.id;
      for (const termId of termIds) {
        const k = `${subj.id}|${sec.id}|${termId}`;
        if (owned.has(k)) continue; // keep existing (incl. violations)
        owned.set(k, teacherId);
        if (!teacherId.startsWith("(dry:")) {
          assignRows.push({ id: keyId("tsa", `${subj.code}_${sec.name}_${termId.slice(-4)}`), teacherId, subjectId: subj.id, sectionId: sec.id, termId });
        } else {
          assignRows.push({ id: `(dry)`, teacherId, subjectId: subj.id, sectionId: sec.id, termId });
        }
      }
    });
  }
  let assignCount = 0;
  if (!DRY && assignRows.length) {
    assignCount = await bulkCreate("Assignments", assignRows.length, (ch) => prisma.teacherSubjectAssignment.createMany({ data: ch, skipDuplicates: true }) as never as Promise<{ count: number }>, assignRows, 500);
  } else console.log(`  Assignments: ${assignRows.length} (dry)`);
  console.log(`Teachers created: ${teachersCreated}, assignments to add: ${assignRows.length}`);

  // Refresh owner map from DB (post-write) for timetable linkage.
  const allAssign = await prisma.teacherSubjectAssignment.findMany({
    where: { sectionId: { in: secIds }, termId: { in: termIds } },
    select: { teacherId: true, subjectId: true, sectionId: true, termId: true },
  });
  const ownerOf = new Map<string, string>();
  for (const a of allAssign) {
    const k = `${a.subjectId}|${a.sectionId}|${a.termId}`;
    if (!ownerOf.has(k)) ownerOf.set(k, a.teacherId);
  }

  // ---- 7. TeacherName catalog for every owner ----
  const ownerIds = [...new Set(ownerOf.values())];
  const users = await prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, fullName: true, email: true } });
  const userById = new Map(users.map((u) => [u.id, u]));
  const existingTNames = await prisma.teacherName.findMany({ select: { id: true, userId: true, code: true, name: true } });
  const tnameByUser = new Map(existingTNames.filter((t) => t.userId).map((t) => [t.userId as string, t.id]));
  const usedNames = new Set(existingTNames.map((t) => t.name));
  const usedCodes = new Set(existingTNames.map((t) => t.code).filter((c): c is string => !!c));
  let codeN = 1;
  while (usedCodes.has(`MS-${String(codeN).padStart(3, "0")}`)) codeN++;
  if (!DRY) {
    for (const uid of ownerIds) {
      if (tnameByUser.has(uid)) continue;
      const u = userById.get(uid);
      if (!u) continue;
      let nm = u.fullName;
      let sfx = 2;
      while (usedNames.has(nm)) nm = `${u.fullName} ${sfx++}`;
      while (usedCodes.has(`MS-${String(codeN).padStart(3, "0")}`)) codeN++;
      const code = `MS-${String(codeN++).padStart(3, "0")}`;
      try {
        const row = await prisma.teacherName.create({ data: { id: keyId("tname", u.email), name: nm, code, userId: uid } });
        tnameByUser.set(uid, row.id);
        usedNames.add(nm);
        usedCodes.add(code);
      } catch { /* race/dup — resolve below */ }
    }
    const again = await prisma.teacherName.findMany({ where: { userId: { in: ownerIds } }, select: { userId: true, id: true } });
    for (const r of again) if (r.userId) tnameByUser.set(r.userId, r.id);
  }

  // ---- 8. TeacherTermGrant (owner x T1/T2) ----
  const grantRows = ownerIds.flatMap((uid) => termIds.map((termId) => ({
    id: keyId("ttg", `${uid.slice(-6)}_${termId.slice(-4)}`),
    userId: uid, termId, via: "code", attendanceVerifiedAt: new Date("2026-06-10T00:00:00Z"),
  })));
  if (!DRY && grantRows.length) {
    await bulkCreate("TermGrants", grantRows.length, (ch) => prisma.teacherTermGrant.createMany({ data: ch, skipDuplicates: true }) as never as Promise<{ count: number }>, grantRows, 500);
  } else console.log(`  TermGrants: ${grantRows.length} (dry)`);

  // ---- 9. Timetable: 40 DRAFT slots per section+term ----
  const existingTT = await prisma.sectionTimetableEntry.findMany({
    where: { sectionId: { in: secIds }, termId: { in: termIds } },
    select: { sectionId: true, termId: true, day: true, period: true },
  });
  const haveSlot = new Set(existingTT.map((e) => `${e.sectionId}|${e.termId}|${e.day}|${e.period}`));
  const ttRows: { id: string; sectionId: string; subjectId: string; termId: string; day: number; period: number; teacherNameId: string | null; status: "DRAFT" }[] = [];
  for (const sec of secs) {
    const subs = byGrade.get(sec.gradeLevel)!;
    const offset = [...sec.name].reduce((a, c) => a + c.charCodeAt(0), 0) % subs.length;
    for (const termId of termIds) {
      for (const day of DAYS) {
        for (const period of PERIODS) {
          if (haveSlot.has(`${sec.id}|${termId}|${day}|${period}`)) continue;
          const subj = subs[((day - 1) * PERIODS.length + period + offset) % subs.length];
          const owner = ownerOf.get(`${subj.id}|${sec.id}|${termId}`) ?? null;
          ttRows.push({
            id: keyId("tte", `${sec.name}_${termId.slice(-4)}_${day}_${period}`),
            sectionId: sec.id, subjectId: subj.id, termId, day, period,
            teacherNameId: owner ? (tnameByUser.get(owner) ?? null) : null,
            status: "DRAFT",
          });
        }
      }
    }
  }
  if (!DRY && ttRows.length) {
    await bulkCreate("Timetable", ttRows.length, (ch) => prisma.sectionTimetableEntry.createMany({ data: ch, skipDuplicates: true }) as never as Promise<{ count: number }>, ttRows, 500);
  } else console.log(`  Timetable: ${ttRows.length} (dry)`);

  // ---- 10. Verify ----
  if (!DRY) {
    const check = await prisma.teacherSubjectAssignment.findMany({ where: { sectionId: { in: secIds }, termId: { in: termIds } }, select: { subjectId: true, sectionId: true, termId: true, teacherId: true } });
    const g = new Map<string, Set<string>>();
    for (const a of check) {
      const k = `${a.subjectId}|${a.sectionId}|${a.termId}`;
      if (!g.has(k)) g.set(k, new Set());
      g.get(k)!.add(a.teacherId);
    }
    const bad = [...g.values()].filter((s) => s.size > 1).length;
    console.log(`Verify: keys=${g.size} multi-teacher violations=${bad} (expect 0 new)`);
    const slots = await prisma.sectionTimetableEntry.groupBy({ by: ["sectionId", "termId", "status"], _count: { _all: true }, where: { sectionId: { in: secIds }, termId: { in: termIds } } });
    const secName = new Map(secs.map((s) => [s.id, s.name]));
    for (const r of slots) console.log(`  slots ${secName.get(r.sectionId)} term=${r.termId.slice(0, 4)} status=${r.status} n=${r._count._all}`);
  }
  console.log(`Done — assign added target=${assignCount}, timetable added target=${DRY ? ttRows.length + " (dry)" : ttRows.length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
