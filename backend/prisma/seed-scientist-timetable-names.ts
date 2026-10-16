import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";
import { keyId } from "./seed/utils/rng.js";
import { bulkCreate } from "./seed/utils/chunk.js";
import { buildNamesForGenders } from "./data/filipino-names.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });
const DRY = process.argv.includes("--dry-run");
const SY_NAME = "SY 2026-2027";
const DAYS = [1, 2, 3, 4, 5];
const PERIODS = [0, 1, 2, 3, 4, 5, 6, 7]; // 8 periods/day

const SECTION_NAMES = [
  "Einstein", "Newton", "Curie", "Tesla", "Darwin", "Galileo",
  "Edison", "Franklin", "Mendel", "Pasteur", "Archimedes", "Aristotle", "Reogie",
];
const GRADES = ["G7", "G8", "G9", "G10", "G11", "G12"];

async function main() {
  const userCountBefore = await prisma.user.count();
  const sy = await prisma.schoolYear.findFirst({ where: { name: SY_NAME }, select: { id: true } });
  if (!sy) throw new Error(`School year "${SY_NAME}" not found`);
  const terms = await prisma.term.findMany({ where: { schoolYearId: sy.id }, orderBy: { termNumber: "asc" } });
  const t1 = terms.find((t) => t.termNumber === 1);
  const t2 = terms.find((t) => t.termNumber === 2);
  if (!t1 || !t2) throw new Error("T1/T2 missing");
  const termIds = [t1.id, t2.id];
  console.log(`Scope: ${SY_NAME} T1+T2 DRY=${DRY} usersBefore=${userCountBefore}`);

  // ---- 1. Subjects per grade + category (must already exist: 8 CORE + 1 ELECTIVE) ----
  const secs = await prisma.section.findMany({ where: { name: { in: SECTION_NAMES }, schoolYearId: sy.id }, select: { id: true, name: true, gradeLevel: true } });
  const missingSecs = SECTION_NAMES.filter((n) => !secs.some((s) => s.name === n));
  if (missingSecs.length) throw new Error(`Sections missing: ${missingSecs.join(", ")}`);
  const byGrade = new Map<string, { id: string; code: string }[]>();
  for (const grade of GRADES) {
    const subs = await prisma.subject.findMany({ where: { gradeLevel: grade as never }, select: { id: true, code: true, category: true }, orderBy: { code: "asc" } });
    const core = subs.filter((s) => s.category === "CORE").length;
    const elec = subs.filter((s) => s.category === "ELECTIVE").length;
    console.log(`${grade}: subjects=${subs.length} core=${core} elective=${elec}`);
    if (subs.length !== 9 || core !== 8 || elec !== 1) throw new Error(`${grade}: expected 9 subjects (8 CORE + 1 ELECTIVE)`);
    byGrade.set(grade, subs);
  }

  // ---- 2. Teacher list (names only, NO accounts): 9 per grade, one per subject ----
  const genders: ("Male" | "Female")[] = Array.from({ length: 120 }, (_, i) => (i % 2 === 0 ? "Female" : "Male"));
  const pool = buildNamesForGenders(genders);
  const taken = new Set([
    ...(await prisma.user.findMany({ select: { fullName: true } })).map((u) => u.fullName),
    ...(await prisma.teacherName.findMany({ select: { name: true } })).map((t) => t.name),
  ]);
  const freshNames = pool.filter((n) => !taken.has(n));
  if (freshNames.length < 54) throw new Error("Not enough unused Filipino names");
  const usedCodes = new Set((await prisma.teacherName.findMany({ select: { code: true } })).map((t) => t.code).filter((c): c is string => !!c));
  let codeN = 1;
  while (usedCodes.has(`MS-${String(codeN).padStart(3, "0")}`)) codeN++;

  // subjectId -> teacherNameId (per grade: sorted subjects[i] <-> fresh teacher[i])
  const tnameOfSubject = new Map<string, string>();
  const teacherOfSubject = new Map<string, string>(); // subjectId -> display name (for logging)
  let ni = 0;
  for (const grade of GRADES) {
    const subs = byGrade.get(grade)!;
    console.log(`${grade}:`);
    for (const subj of subs) {
      const nm = freshNames[ni++];
      let code = `MS-${String(codeN).padStart(3, "0")}`;
      while (usedCodes.has(code)) code = `MS-${String(++codeN).padStart(3, "0")}`;
      codeN++;
      usedCodes.add(code);
      if (!DRY) {
        const row = await prisma.teacherName.create({ data: { id: keyId("tname", `sci-${grade}-${subj.code}`), name: nm, code, userId: null } });
        tnameOfSubject.set(subj.id, row.id);
      } else {
        tnameOfSubject.set(subj.id, `(dry:${code})`);
      }
      teacherOfSubject.set(subj.id, nm);
      console.log(`  ${subj.code} -> ${nm} [${code}]`);
    }
  }

  // ---- 3. Rebuild timetable slots (wipe scope first) ----
  if (!DRY) {
    const del = await prisma.sectionTimetableEntry.deleteMany({ where: { sectionId: { in: secs.map((s) => s.id) }, termId: { in: termIds } } });
    console.log(`Wiped existing slots in scope: ${del.count}`);
  }
  const ttRows: { id: string; sectionId: string; subjectId: string; termId: string; day: number; period: number; teacherNameId: string | null; status: "DRAFT" }[] = [];
  for (const grade of GRADES) {
    const subs = byGrade.get(grade)!;
    const gsecs = secs.filter((s) => s.gradeLevel === grade).sort((a, b) => a.name.localeCompare(b.name));
    gsecs.forEach((sec, pos) => {
      // Distinct offsets mod 9 per section => same teacher never double-booked.
      // Sections of one grade share teachers, so residues must differ.
      const offset = (pos * 3) % subs.length;
      for (const termId of termIds) {
        for (const day of DAYS) {
          for (const period of PERIODS) {
            const idx = (day - 1) * PERIODS.length + period;
            const subj = subs[(idx + offset) % subs.length];
            ttRows.push({
              id: keyId("tte", `${sec.name}_${termId.slice(-4)}_${day}_${period}`),
              sectionId: sec.id, subjectId: subj.id, termId, day, period,
              teacherNameId: DRY ? null : (tnameOfSubject.get(subj.id) ?? null),
              status: "DRAFT",
            });
          }
        }
      }
    });
  }
  if (!DRY) {
    await bulkCreate("Timetable", ttRows.length, (ch) => prisma.sectionTimetableEntry.createMany({ data: ch, skipDuplicates: true }) as never as Promise<{ count: number }>, ttRows, 500);
  } else console.log(`  Timetable: ${ttRows.length} (dry)`);

  // ---- 4. Verify ----
  if (!DRY) {
    const secIds = secs.map((s) => s.id);
    const counts = await prisma.sectionTimetableEntry.groupBy({ by: ["sectionId", "termId"], _count: { _all: true }, where: { sectionId: { in: secIds }, termId: { in: termIds } } });
    const badSlots = counts.filter((c) => c._count._all !== 40);
    console.log(`Slot check: groups=${counts.length} (expect 26), wrong-size=${badSlots.length}`);
    // Conflict check: same teacher, same term/day/period in >1 section.
    const rows = await prisma.sectionTimetableEntry.findMany({ where: { sectionId: { in: secIds }, termId: { in: termIds }, teacherNameId: { not: null } }, select: { teacherNameId: true, termId: true, day: true, period: true } });
    const seen = new Map<string, number>();
    for (const r of rows) {
      const k = `${r.teacherNameId}|${r.termId}|${r.day}|${r.period}`;
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    const conflicts = [...seen.values()].filter((n) => n > 1).length;
    console.log(`Conflict check: teacher-slots=${seen.size} double-booked=${conflicts} (expect 0)`);
    // One teacher -> one subject per grade.
    const detail = await prisma.sectionTimetableEntry.findMany({ where: { sectionId: { in: secIds }, termId: { in: termIds } }, select: { teacherNameId: true, subjectId: true } });
    const subjPerTeacher = new Map<string, Set<string>>();
    for (const d of detail) {
      if (!d.teacherNameId) continue;
      if (!subjPerTeacher.has(d.teacherNameId)) subjPerTeacher.set(d.teacherNameId, new Set());
      subjPerTeacher.get(d.teacherNameId)!.add(d.subjectId);
    }
    const multi = [...subjPerTeacher.values()].filter((s) => s.size !== 1).length;
    console.log(`Ownership check: teachers=${subjPerTeacher.size} (expect 54) with !=1 subject: ${multi} (expect 0)`);
    const userCountAfter = await prisma.user.count();
    console.log(`User accounts: before=${userCountBefore} after=${userCountAfter} (expect equal, no accounts created)`);
  }
  console.log("Done");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
