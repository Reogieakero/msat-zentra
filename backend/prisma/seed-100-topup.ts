import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";
import argon2 from "argon2";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });
const DRY = process.argv.includes("--dry-run");
const MIN = 100;
const ROSTER_PER_SECTION = 40;
const PROFILE_TARGET = 120;

function keyId(prefix: string, key: string): string {
  return `${prefix}_${key.replace(/[^a-zA-Z0-9]/g, "_")}`.slice(0, 60);
}
function hash01(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}
function pctFor(studentKey: string, asmKey: string): number {
  const r = hash01(`${studentKey}::${asmKey}`);
  if (r < 0.7) return 82 + r * (17 / 0.7);
  if (r < 0.85) return 75 + ((r - 0.7) / 0.15) * 6.9;
  return 60 + ((r - 0.85) / 0.15) * 14.9;
}
function inTermDateFor(termStart: Date, termEnd: Date, seed: number): Date {
  const s = termStart.getTime();
  const e = Math.min(termEnd.getTime(), Date.now());
  if (e <= s) return new Date(s);
  return new Date(s + ((seed * 7919 * 104729) % (e - s)));
}

const GRADE_LEVELS = ["G7", "G8", "G9", "G10", "G11", "G12"] as const;
const SECTION_LETTERS = ["A", "B", "C"];
const SUBJECT_NAMES: Record<string, { name: string; code: string }[]> = {
  G7: [{ name: "Math 7", code: "MATH7" }, { name: "English 7", code: "ENG7" }, { name: "Science 7", code: "SCI7" }, { name: "Filipino 7", code: "FIL7" }, { name: "Araling Panlipunan 7", code: "AP7" }, { name: "MAPEH 7", code: "MAPEH7" }],
  G8: [{ name: "Math 8", code: "MATH8" }, { name: "English 8", code: "ENG8" }, { name: "Science 8", code: "SCI8" }],
  G9: [{ name: "Math 9", code: "MATH9" }, { name: "English 9", code: "ENG9" }, { name: "Science 9", code: "SCI9" }],
  G10: [{ name: "Math 10", code: "MATH10" }, { name: "English 10", code: "ENG10" }, { name: "Science 10", code: "SCI10" }],
  G11: [{ name: "Gen Math 11", code: "GMM11" }, { name: "Purposive Comm 11", code: "PC11" }, { name: "Earth Sci 11", code: "ES11" }],
  G12: [{ name: "Calc 12", code: "CALC12" }, { name: "Research 12", code: "RES12" }, { name: "Physics 12", code: "PHY12" }, { name: "Filipino 12", code: "FIL12" }, { name: "Contemporary Arts 12", code: "ARTS12" }, { name: "Entrepreneurship 12", code: "ENTREP12" }],
};
const FIRST = ["Maria", "Juan", "Ana", "Pedro", "Sofia", "Lucas", "Elena", "Miguel", "Rosa", "Jose", "Carmen", "Antonio", "Lucia", "Diego", "Gabriela", "Andres", "Isabella", "Rafael", "Paula", "Manuel", "Teresa", "Francisco", "Liza", "Carlos", "Mark", "Jenny", "Ramon", "Lorna", "Efren", "Divina"];
const LAST = ["Santos", "Reyes", "Cruz", "Garcia", "Mendoza", "Torres", "Flores", "Ramos", "Diaz", "Castillo", "Manalo", "Bautista", "Villanueva", "Ocampo", "Aquino", "Gonzales", "Ferrer", "Salazar", "Mercado", "Aguilar", "Delos Reyes", "Tanjuan", "Villanueva", "Padilla"];
const MI100 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const INCIDENTS = ["Disruptive behavior during class discussion", "Late submission of assignments for three consecutive days", "Verbal altercation with a classmate during recess", "Incomplete homework without prior notice", "Sleeping during morning session", "Unauthorized use of mobile phone in class", "Bullying report filed by classmate", "Frequent tardiness without excuse slip", "Academic dishonesty during quiz", "Vandalism of classroom property"];
const COMPLAINTS = ["Mild fever and headache", "Stomach ache after lunch", "Minor abrasion on knee from P.E.", "Cough and sore throat", "Dizziness during flag ceremony", "Sprained ankle during sports", "Eye irritation", "Toothache"];
const DIAGNOSES = ["Viral fever, advised rest and hydration", "Acute gastritis, advised dietary monitoring", "Superficial abrasion, cleaned and dressed", "Pharyngitis, advised rest", "Mild dehydration, advised fluid intake", "Sprain grade 1, RICE advised", "Conjunctivitis, referred for checkup", "Dental caries, referred to dentist"];
const COMPONENTS = [
  { type: "WRITTEN_WORK" as const, weight: 30, titles: ["Quiz 1", "Quiz 2"], max: 50 },
  { type: "PERFORMANCE_TASK" as const, weight: 50, titles: ["Task 1", "Task 2"], max: 100 },
  { type: "EXAM" as const, weight: 20, titles: ["Midterm", "Finals"], max: 100 },
];

async function main() {
  const plan: { table: string; have: number; add: number }[] = [];
  const note = (table: string, have: number, add: number) => plan.push({ table, have, add });

  // ---- 0. core staff ----
  const staffHash = DRY ? "dry" : await argon2.hash("Zentra2025!");
  const STAFF = [
    { email: "principal@zentra.test", fullName: "Default Principal", role: "principal" as const },
    { email: "registrar@zentra.test", fullName: "Default Registrar", role: "registrar" as const },
    { email: "record_keeper@zentra.test", fullName: "Default Record Keeper", role: "record_keeper" as const },
    { email: "nurse@zentra.test", fullName: "Default Nurse", role: "nurse" as const },
    { email: "guidance@zentra.test", fullName: "Default Guidance Counselor", role: "guidance_counselor" as const },
    { email: "adm@zentra.test", fullName: "Default ADM Coordinator", role: "adm_coordinator" as const },
  ];
  if (!DRY) {
    for (const a of STAFF) {
      await prisma.user.upsert({ where: { email: a.email }, update: { fullName: a.fullName, role: a.role, passwordHash: staffHash, status: "active" }, create: { email: a.email, fullName: a.fullName, role: a.role, passwordHash: staffHash, status: "active" } });
    }
  }
  const principal = await prisma.user.findFirst({ where: { role: "principal" } });
  const createdBy = principal?.id ?? "system";

  // ---- SY + terms ----
  let sy = await prisma.schoolYear.findFirst({ where: { name: "SY 2026-2027" } });
  if (!sy) {
    if (DRY) { console.log("DRY: would create SY 2026-2027"); }
    else {
      await prisma.schoolYear.updateMany({ where: { isActive: true }, data: { isActive: false } });
      sy = await prisma.schoolYear.create({ data: { name: "SY 2026-2027", startDate: new Date("2026-06-08T00:00:00Z"), endDate: new Date("2027-04-08T00:00:00Z"), isActive: true, createdBy } });
    }
  }
  const syId = sy?.id ?? "dry-sy";
  const DEP_TERMS = [
    { n: 1, start: new Date("2026-06-08T00:00:00Z"), end: new Date("2026-09-15T00:00:00Z") },
    { n: 2, start: new Date("2026-09-16T00:00:00Z"), end: new Date("2026-12-18T00:00:00Z") },
    { n: 3, start: new Date("2027-01-04T00:00:00Z"), end: new Date("2027-04-08T00:00:00Z") },
  ];
  if (!DRY && sy) {
    await prisma.schoolYear.update({ where: { id: sy.id }, data: { isActive: true } });
    for (const t of DEP_TERMS) {
      await prisma.term.upsert({ where: { schoolYearId_termNumber: { schoolYearId: sy.id, termNumber: t.n } }, update: { startDate: t.start, endDate: t.end }, create: { schoolYearId: sy.id, termNumber: t.n, startDate: t.start, endDate: t.end } });
    }
  }
  const termsAll = await prisma.term.findMany({ where: { schoolYearId: syId }, orderBy: { termNumber: "asc" } });
  const t1 = termsAll.find(t => t.termNumber === 1);
  const t2 = termsAll.find(t => t.termNumber === 2);
  const t3 = termsAll.find(t => t.termNumber === 3);
  const gradeTerms = [t1, t2].filter(Boolean) as typeof termsAll;
  if (!t1 || !t2) { console.log("WARN: T1/T2 missing (dry=" + DRY + "). Gradebook needs both terms."); if (!DRY) throw new Error("T1/T2 missing"); }

  const nurse = await prisma.user.findFirst({ where: { role: "nurse" } });
  const guidance = await prisma.user.findFirst({ where: { role: "guidance_counselor" } });
  const admCoord = await prisma.user.findFirst({ where: { role: "adm_coordinator" } });
  const registrarUser = await prisma.user.findFirst({ where: { role: "registrar" } });
  if (!DRY && (!nurse || !guidance || !admCoord || !registrarUser)) throw new Error("core staff missing");

  // ---- subjects (24, capped waiver) ----
  if (!DRY) {
    for (const g of GRADE_LEVELS) for (const s of SUBJECT_NAMES[g]) {
      await prisma.subject.upsert({ where: { code_gradeLevel: { code: s.code, gradeLevel: g as any } }, update: { name: s.name }, create: { name: s.name, code: s.code, gradeLevel: g as any } });
    }
  }
  const subjects = await prisma.subject.findMany({ select: { id: true, code: true, gradeLevel: true } });
  const subjByKey = new Map(subjects.map(s => [`${s.gradeLevel}:${s.code}`, s]));
  note("Subject(capped~24)", subjects.length, DRY ? Math.max(0, 24 - subjects.length) : 0);

  // ---- teachers pool: ensure >= 20 subject_teachers ----
  let teachers = await prisma.user.findMany({ where: { role: "subject_teacher" }, select: { id: true, email: true } });
  const teacherNeed = Math.max(0, 20 - teachers.length);
  if (!DRY && teacherNeed > 0) {
    for (let i = 0; i < teacherNeed; i++) {
      const email = `s100.teacher${teachers.length + i + 1}@zentra.test`;
      const u = await prisma.user.upsert({ where: { email }, update: {}, create: { id: keyId("s100_tch", email), email, fullName: `Seed100 Teacher ${teachers.length + i + 1}`, role: "subject_teacher", passwordHash: staffHash, status: "active" } });
      await prisma.staffProfile.upsert({ where: { userId: u.id }, update: {}, create: { userId: u.id, employeeId: `S100T${Date.now() % 100000}${i}`, isAdviser: false } });
    }
    teachers = await prisma.user.findMany({ where: { role: "subject_teacher" }, select: { id: true, email: true } });
  }
  note("User.teacherPool", teachers.length, DRY ? teacherNeed : 0);

  // ---- sections: exactly 3 per grade (keep Mapa as G7-A) ----
  let sections = await prisma.section.findMany({ where: { schoolYearId: syId }, select: { id: true, name: true, gradeLevel: true, adviserId: true } });
  // rename Mapa -> G7-A for consistency (only if G7-A free)
  const mapa = sections.find(s => s.name === "Mapa");
  if (mapa && !sections.some(s => s.name === "G7-A")) {
    if (!DRY) await prisma.section.update({ where: { id: mapa.id }, data: { name: "G7-A" } });
    mapa.name = "G7-A";
  }
  sections = await prisma.section.findMany({ where: { schoolYearId: syId }, select: { id: true, name: true, gradeLevel: true, adviserId: true } });
  let secAdds = 0;
  if (!DRY) {
    let advN = 0;
    for (const g of GRADE_LEVELS) {
      const have = sections.filter(s => s.gradeLevel === (g as any));
      const need = Math.max(0, 3 - have.length);
      const takenNames = new Set(have.map(s => s.name));
      for (let k = 0; k < need; k++) {
        let letter = SECTION_LETTERS.find(l => !takenNames.has(`${g}-${l}`)) ?? `X${k}`;
        takenNames.add(`${g}-${letter}`);
        const email = `adviser.${g.toLowerCase()}.${letter.toLowerCase()}@zentra.test`;
        const adv = await prisma.user.upsert({ where: { email }, update: { fullName: `Adviser ${g}-${letter}`, role: "adviser", passwordHash: staffHash, status: "active" }, create: { email, fullName: `Adviser ${g}-${letter}`, role: "adviser", passwordHash: staffHash, status: "active" } });
        await prisma.staffProfile.upsert({ where: { userId: adv.id }, update: { isAdviser: true }, create: { userId: adv.id, employeeId: `S100ADV${g}${letter}${advN++}`, isAdviser: true, department: "Academic" } });
        await prisma.section.create({ data: { name: `${g}-${letter}`, gradeLevel: g as any, schoolYearId: syId, adviserId: adv.id } });
        secAdds++;
      }
    }
    // ensure every section has adviser
    sections = await prisma.section.findMany({ where: { schoolYearId: syId }, select: { id: true, name: true, gradeLevel: true, adviserId: true } });
    for (const s of sections.filter(s => !s.adviserId)) {
      const email = `adviser.${s.gradeLevel.toLowerCase()}.${s.name.replace(/[^a-z0-9]/gi, "").toLowerCase()}@zentra.test`;
      const adv = await prisma.user.upsert({ where: { email }, update: { role: "adviser", passwordHash: staffHash, status: "active" }, create: { email, fullName: `Adviser ${s.name}`, role: "adviser", passwordHash: staffHash, status: "active" } });
      await prisma.staffProfile.upsert({ where: { userId: adv.id }, update: { isAdviser: true }, create: { userId: adv.id, employeeId: `S100ADV${s.id.slice(0, 6)}`, isAdviser: true } });
      await prisma.section.update({ where: { id: s.id }, data: { adviserId: adv.id } });
    }
  } else {
    for (const g of GRADE_LEVELS) { const have = sections.filter(s => s.gradeLevel === (g as any)).length; secAdds += Math.max(0, 3 - have); }
  }
  sections = await prisma.section.findMany({ where: { schoolYearId: syId }, select: { id: true, name: true, gradeLevel: true, adviserId: true, schoolYearId: true } });
  note("Section(18 fixed)", sections.length, secAdds);

  // ---- roster 40 per section = 720 ----
  const existingLrns = new Set((await prisma.studentRoster.findMany({ select: { lrn: true } })).map(r => r.lrn));
  (await prisma.studentProfile.findMany({ select: { lrn: true } })).forEach(p => existingLrns.add(p.lrn));
  (await prisma.user.findMany({ select: { lrn: true } })).forEach(u => { if (u.lrn) existingLrns.add(u.lrn); });
  const rosterCounts = new Map<string, number>();
  for (const s of sections) rosterCounts.set(s.id, await prisma.studentRoster.count({ where: { sectionId: s.id } }));
  let rosterNeed = 0;
  for (const s of sections) rosterNeed += Math.max(0, ROSTER_PER_SECTION - (rosterCounts.get(s.id) ?? 0));
  if (DRY) {
    const totalHave = [...rosterCounts.values()].reduce((a, b) => a + b, 0);
    rosterNeed = Math.max(0, 18 * ROSTER_PER_SECTION - totalHave);
  }
  if (!DRY && rosterNeed > 0) {
    for (const s of sections) {
      const have = rosterCounts.get(s.id) ?? 0;
      const need = Math.max(0, ROSTER_PER_SECTION - have);
      if (need === 0) continue;
      const rows: any[] = [];
      let seq = have + 1, guard = 0;
      while (rows.length < need && guard < need * 30) {
        guard++;
        const gnum = s.gradeLevel.replace("G", "");
        const lrn = `10${gnum}${SECTION_LETTERS.indexOf(s.name.slice(-1)) >= 0 ? SECTION_LETTERS.indexOf(s.name.slice(-1)) + 1 : 1}${String(seq).padStart(4, "0")}${String(guard % 10)}`.slice(0, 12);
        // ensure uniqueness: append guard-based suffix on collision
        const cand = existingLrns.has(lrn) ? `${lrn}${guard}`.slice(0, 13) : lrn;
        if (existingLrns.has(cand)) continue;
        existingLrns.add(cand);
        const fn = FIRST[(have + rows.length) % FIRST.length];
        const ln = LAST[(have * 3 + rows.length * 7) % LAST.length];
        rows.push({ id: keyId("s100_ros", `${s.id}_${have + rows.length + 1}_${guard}`), lrn: cand, fullName: `${fn} ${MI100[(have + rows.length * 3) % MI100.length]}. ${ln}`, gradeLevel: s.gradeLevel, sectionId: s.id, schoolYearId: syId });
        seq++;
      }
      if (rows.length) await prisma.studentRoster.createMany({ data: rows, skipDuplicates: true });
    }
  }
  const rosterAll = await prisma.studentRoster.findMany({ select: { id: true, lrn: true, fullName: true, sectionId: true, gradeLevel: true } });
  note("StudentRoster(720)", rosterAll.length, rosterNeed);

  // ---- profiles + parents (120) ----
  const profHave = await prisma.studentProfile.count();
  const profNeed = Math.max(0, PROFILE_TARGET - profHave);
  const studentHash = DRY ? "dry" : await argon2.hash("Student2025!");
  const parentHash = DRY ? "dry" : await argon2.hash("Parent2025!");
  if (!DRY && profNeed > 0) {
    const profileLrns = new Set((await prisma.studentProfile.findMany({ select: { lrn: true } })).map(p => p.lrn));
    const cands = rosterAll.filter(r => !profileLrns.has(r.lrn)).slice(0, profNeed);
    const secAdv = new Map(sections.map(s => [s.id, s.adviserId ?? createdBy]));
    for (const r of cands) {
      const sEmail = `s100.${r.lrn.toLowerCase()}@zentra.test`;
      const pEmail = `p100.${r.lrn.toLowerCase()}@zentra.test`;
      const su = await prisma.user.upsert({ where: { email: sEmail }, update: {}, create: { id: keyId("s100_stu", r.lrn), email: sEmail, fullName: r.fullName, role: "student", passwordHash: studentHash, status: "active", lrn: r.lrn } });
      await prisma.studentProfile.upsert({ where: { userId: su.id }, update: {}, create: { userId: su.id, lrn: r.lrn, gradeLevel: r.gradeLevel as any, sectionId: r.sectionId } });
      const pu = await prisma.user.upsert({ where: { email: pEmail }, update: {}, create: { id: keyId("s100_par", r.lrn), email: pEmail, fullName: `Parent of ${r.fullName}`, role: "parent", passwordHash: parentHash, status: "active" } });
      await prisma.parentProfile.upsert({ where: { userId: pu.id }, update: {}, create: { userId: pu.id, address: "Quezon City", occupation: "Vendor" } });
      await prisma.parentStudentLink.upsert({ where: { parentId_studentId: { parentId: pu.id, studentId: su.id } }, update: {}, create: { parentId: pu.id, studentId: su.id, relationship: "Guardian", approvedBy: secAdv.get(r.sectionId) ?? createdBy } }).catch(() => prisma.parentStudentLink.createMany({ data: [{ parentId: pu.id, studentId: su.id, relationship: "Guardian" }], skipDuplicates: true }));
    }
  }
  const profAll = await prisma.studentProfile.findMany({ select: { userId: true, lrn: true, sectionId: true, gradeLevel: true } });
  const parentHave = await prisma.parentProfile.count();
  const linkHave = await prisma.parentStudentLink.count();
  note("StudentProfile(120+)", profAll.length, profNeed);
  note("ParentProfile(100+)", parentHave, Math.max(0, MIN - parentHave));
  note("ParentStudentLink(100+)", linkHave, Math.max(0, MIN - linkHave));

  const advisers = await prisma.user.findMany({ where: { role: "adviser" }, select: { id: true } });
  teachers = await prisma.user.findMany({ where: { role: "subject_teacher" }, select: { id: true } });
  const owners = [...advisers, ...teachers];
  const secById = new Map(sections.map(s => [s.id, s]));
  const rosterByGrade = new Map<string, typeof rosterAll>();
  for (const r of rosterAll) { const a = rosterByGrade.get(r.gradeLevel) ?? []; a.push(r); rosterByGrade.set(r.gradeLevel, a); }

  // ---- gradebook T1+T2 ----
  let compAdds = 0, asmAdds = 0, gradeAdds = 0, finalAdds = 0;
  const allAsm: { id: string; maxScore: number; compId: string; subjectId: string; termId: string; title: string; subjCode: string; grade: string }[] = [];
  if (!DRY && gradeTerms.length === 2 && subjects.length > 0) {
    for (const term of gradeTerms) {
      for (const subj of subjects) {
        for (const c of COMPONENTS) {
          await prisma.gradeComponent.upsert({ where: { subjectId_termId_componentType: { subjectId: subj.id, termId: term.id, componentType: c.type } }, update: { weightPercentage: c.weight }, create: { subjectId: subj.id, termId: term.id, componentType: c.type, weightPercentage: c.weight } });
        }
      }
    }
    const comps = await prisma.gradeComponent.findMany({ where: { termId: { in: gradeTerms.map(t => t.id) } }, select: { id: true, subjectId: true, termId: true, componentType: true } });
    const subjOf = new Map(subjects.map(s => [s.id, s]));
    for (const comp of comps) {
      const subj = subjOf.get(comp.subjectId)!;
      const def = COMPONENTS.find(d => d.type === comp.componentType)!;
      for (const title of def.titles) {
        const id = keyId("s100_asm", `${subj.code}_T${gradeTerms.findIndex(t => t.id === comp.termId) + 1}_${comp.componentType}_${title}`);
        const ex = await prisma.assessment.findFirst({ where: { gradeComponentId: comp.id, title }, select: { id: true, maxScore: true } });
        if (ex) { allAsm.push({ id: ex.id, maxScore: ex.maxScore, compId: comp.id, subjectId: subj.id, termId: comp.termId, title, subjCode: subj.code, grade: subj.gradeLevel }); continue; }
        const owner = owners.length ? owners[Math.floor(hash01(id) * owners.length)].id : createdBy;
        const termObj = gradeTerms.find(t => t.id === comp.termId)!;
        const created = await prisma.assessment.create({ data: { id, gradeComponentId: comp.id, title, maxScore: def.max, dateGiven: inTermDateFor(termObj.startDate ?? new Date("2026-06-08"), termObj.endDate ?? new Date("2026-12-18"), hash01(id) * 100000), createdBy: owner }, select: { id: true, maxScore: true } }).catch(async () => await prisma.assessment.findFirstOrThrow({ where: { gradeComponentId: comp.id, title }, select: { id: true, maxScore: true } }));
        allAsm.push({ id: created.id, maxScore: created.maxScore, compId: comp.id, subjectId: subj.id, termId: comp.termId, title, subjCode: subj.code, grade: subj.gradeLevel });
        asmAdds++;
      }
    }
    // teacher assignments: one per (subject,section,term)
    const existAssign = await prisma.teacherSubjectAssignment.findMany({ where: { termId: { in: gradeTerms.map(t => t.id) } }, select: { subjectId: true, sectionId: true, termId: true } });
    const taken = new Set(existAssign.map(a => `${a.subjectId}|${a.sectionId}|${a.termId}`));
    const assignRows: any[] = [];
    owners.length || owners.push({ id: createdBy } as any);
    let oi = 0;
    for (const term of gradeTerms) for (const sec of sections) for (const subj of subjects.filter(s => s.gradeLevel === sec.gradeLevel)) {
      const k = `${subj.id}|${sec.id}|${term.id}`;
      if (taken.has(k)) continue;
      taken.add(k);
      assignRows.push({ id: keyId("s100_tsa", `${subj.code}_${sec.name}_T${term.termNumber}`), teacherId: owners[oi++ % owners.length].id, subjectId: subj.id, sectionId: sec.id, termId: term.id });
    }
    for (let i = 0; i < assignRows.length; i += 500) await prisma.teacherSubjectAssignment.createMany({ data: assignRows.slice(i, i + 500), skipDuplicates: true });

    // student grades (roster bulk)
    const CHUNK = 1000;
    for (const a of allAsm) {
      const students = rosterByGrade.get(a.grade) ?? [];
      if (!students.length) continue;
      const graded = new Set((await prisma.studentGrade.findMany({ where: { assessmentId: a.id }, select: { rosterId: true } })).map(g => g.rosterId));
      const missing = students.filter(s => !graded.has(s.id));
      if (!missing.length) continue;
      const rows = missing.map(s => {
        const pct = Math.round(pctFor(s.id, a.id) * 10) / 10;
        return { id: keyId("s100_sg", `${a.subjCode}_${a.title}_${s.id.slice(-6)}_${a.id.slice(-4)}`), assessmentId: a.id, rosterId: s.id, rawScore: Math.round(((pct / 100) * a.maxScore) * 10) / 10, percentageScore: pct };
      });
      // dedupe ids within batch
      const seen = new Set<string>(); const dedup = rows.filter(r => (seen.has(r.id) ? false : (seen.add(r.id), true)));
      for (let i = 0; i < dedup.length; i += CHUNK) {
        const ch = dedup.slice(i, i + CHUNK);
        const res = await prisma.studentGrade.createMany({ data: ch, skipDuplicates: true });
        gradeAdds += res.count;
      }
    }
    // final grades (roster bulk)
    const asmBySubjTerm = new Map<string, typeof allAsm>();
    for (const a of allAsm) { const k = `${a.subjectId}|${a.termId}`; const arr = asmBySubjTerm.get(k) ?? []; arr.push(a); asmBySubjTerm.set(k, arr); }
    for (const term of gradeTerms) for (const subj of subjects) {
      const students = rosterByGrade.get(subj.gradeLevel) ?? [];
      if (!students.length) continue;
      const graded = new Set((await prisma.finalGrade.findMany({ where: { subjectId: subj.id, termId: term.id }, select: { rosterId: true } })).map(g => g.rosterId));
      const asms = asmBySubjTerm.get(`${subj.id}|${term.id}`) ?? [];
      const rows: any[] = [];
      for (const s of students) {
        if (graded.has(s.id)) continue;
        const pcts = asms.length ? asms.map(a => pctFor(s.id, a.id)) : [70 + hash01(s.id + subj.id) * 28];
        const avg = Math.round((pcts.reduce((x, y) => x + y, 0) / pcts.length) * 10) / 10;
        const roll = hash01(`${s.id}::${subj.id}::${term.id}::lock`);
        rows.push({ id: keyId("s100_fg", `${subj.code}_T${term.termNumber}_${s.id.slice(-8)}`), rosterId: s.id, subjectId: subj.id, termId: term.id, computedAverage: avg, transmutedGrade: Math.round(avg), remarks: avg >= 75 ? "Passed" : "Failed", lockStatus: roll < 0.6 ? "unlocked" : roll < 0.85 ? "locked" : "adviser_approved" });
      }
      for (let i = 0; i < rows.length; i += CHUNK) {
        const res = await prisma.finalGrade.createMany({ data: rows.slice(i, i + CHUNK), skipDuplicates: true });
        finalAdds += res.count;
      }
    }
    // studentId-path sample (>=100 rows)
    if (profAll.length && allAsm.length) {
      const sampleProfiles = profAll.slice(0, 30);
      const sampleAsm = allAsm.filter(a => a.termId === gradeTerms[0].id).slice(0, 6);
      const srows: any[] = [];
      for (const p of sampleProfiles) for (const a of sampleAsm) {
        const ex = await prisma.studentGrade.findUnique({ where: { assessmentId_studentId: { assessmentId: a.id, studentId: p.userId } }, select: { id: true } }).catch(() => null);
        if (ex) continue;
        const pct = Math.round(pctFor(p.userId, a.id) * 10) / 10;
        srows.push({ id: keyId("s100_sgs", `${a.subjCode}_${p.userId.slice(-6)}_${a.id.slice(-4)}`), assessmentId: a.id, studentId: p.userId, rawScore: Math.round(((pct / 100) * a.maxScore) * 10) / 10, percentageScore: pct });
      }
      for (let i = 0; i < srows.length; i += 500) { const r = await prisma.studentGrade.createMany({ data: srows.slice(i, i + 500), skipDuplicates: true }); gradeAdds += r.count; }
    }
  } else if (DRY) {
    // estimate
    const perGrade = new Map<string, number>(); for (const r of rosterAll) perGrade.set(r.gradeLevel, (perGrade.get(r.gradeLevel) ?? 0) + 1);
    let estG = 0, estF = 0;
    for (const subj of subjects.length ? subjects : Object.entries(SUBJECT_NAMES).flatMap(([g, arr]) => arr.map(a => ({ gradeLevel: g })))) {
      const n = perGrade.get((subj as any).gradeLevel) ?? ROSTER_PER_SECTION * 3;
      estG += n * 6 * 2; estF += n * 2;
    }
    gradeAdds = estG; finalAdds = estF; asmAdds = (subjects.length || 24) * 6 * 2;
  }
  const asmHave = await prisma.assessment.count();
  const sgHave = await prisma.studentGrade.count();
  const fgHave = await prisma.finalGrade.count();
  const compHave = await prisma.gradeComponent.count();
  note("GradeComponent", compHave, compAdds);
  note("Assessment(100+)", asmHave, asmAdds);
  note("StudentGrade(per-student)", sgHave, gradeAdds);
  note("FinalGrade(per-student)", fgHave, finalAdds);
  const tsaHave = await prisma.teacherSubjectAssignment.count();
  note("TeacherSubjectAssignment", tsaHave, 0);

  // refresh lookups after gradebook
  const roster2 = rosterAll.length ? rosterAll : await prisma.studentRoster.findMany({ select: { id: true, lrn: true, fullName: true, sectionId: true, gradeLevel: true } });
  const prof2 = profAll.length ? profAll : await prisma.studentProfile.findMany({ select: { userId: true, lrn: true, sectionId: true, gradeLevel: true } });
  const t1id = t1?.id, t2id = t2?.id;
  const pickTerm = (i: number) => (i % 2 === 0 ? t1id : t2id) ?? gradeTerms[0]?.id ?? "dry";
  const termStartEnd = new Map(termsAll.map(t => [t.id, { s: t.startDate ?? new Date("2026-06-08"), e: t.endDate ?? new Date("2026-12-18") }]));

  async function topupSimple(table: string, have: number, make: (need: number, offset: number) => any[], create: (rows: any[]) => Promise<number>) {
    const need = Math.max(0, MIN - have);
    note(table, have, need);
    if (DRY || need === 0) return 0;
    const rows = make(need, have);
    let done = 0;
    for (let i = 0; i < rows.length; i += 500) done += await create(rows.slice(i, i + 500));
    return done;
  }

  // ---- attendance (subject-era, roster) ----
  {
    const have = await prisma.attendanceRecord.count();
    const target = Math.max(MIN, roster2.length * 3);
    const need = Math.max(0, target - have);
    note("AttendanceRecord(3/roster)", have, need);
    if (!DRY && need > 0 && roster2.length && subjects.length && t1id) {
      const subjByGrade = new Map<string, typeof subjects>();
      for (const s of subjects) { const a = subjByGrade.get(s.gradeLevel) ?? []; a.push(s); subjByGrade.set(s.gradeLevel, a); }
      const rows: any[] = [];
      for (let i = 0; i < need; i++) {
        const r = roster2[i % roster2.length];
        const sec = secById.get(r.sectionId);
        const pool = subjByGrade.get(r.gradeLevel) ?? subjects;
        const subj = pool[i % pool.length];
        const tid = pickTerm(i);
        const se = termStartEnd.get(tid)!;
        const d = inTermDateFor(se.s, se.e, have + i + 7);
        const roll = hash01(`att_${r.id}_${i}`);
        rows.push({ id: keyId("s100_att", `${r.id.slice(-6)}_${i}`), rosterId: r.id, sectionId: r.sectionId, date: d, session: "AM" as const, status: roll < 0.8 ? "present" as const : roll < 0.88 ? "late" as const : roll < 0.94 ? "excused" as const : "absent" as const, recordedBy: sec?.adviserId ?? createdBy, termId: tid, subjectId: subj.id, slot: 1 });
      }
      // avoid date collisions per (roster,subject): offset dates by i
      for (let i = 0; i < rows.length; i++) rows[i].date = new Date(rows[i].date.getTime() + (i % roster2.length) * 3600_000);
      for (let i = 0; i < rows.length; i += 500) await prisma.attendanceRecord.createMany({ data: rows.slice(i, i + 500), skipDuplicates: true });
    }
  }

  // ---- anecdotal (roster 150 + student 60) ----
  {
    const have = await prisma.anecdotalRecord.count();
    const need = Math.max(0, 210 - have);
    note("AnecdotalRecord(210)", have, need);
    if (!DRY && need > 0 && roster2.length) {
      const cats = ["behavioral", "bullying", "academic", "attendance", "health"] as const;
      const rows: any[] = [];
      for (let k = 0; k < need; k++) {
        const useStudent = k >= 150 && prof2.length > 0;
        const r = useStudent ? null : roster2[(have + k) % roster2.length];
        const p = useStudent ? prof2[(have + k) % prof2.length] : null;
        const secId = (r?.sectionId ?? p?.sectionId)!;
        const sec = secById.get(secId);
        const tid = pickTerm(have + k);
        const se = termStartEnd.get(tid)!;
        rows.push({ id: keyId("s100_anec", `${have + k}_${(r?.id ?? p!.userId).slice(-6)}`), ...(r ? { rosterId: r.id } : { studentId: p!.userId }), observerId: sec?.adviserId ?? owners[0]?.id ?? createdBy, sectionId: secId, observationDatetime: inTermDateFor(se.s, se.e, have + k + 13), descriptionOfIncident: INCIDENTS[(have + k) % INCIDENTS.length], descriptionOfLocation: "Classroom", notesRecommendationsActions: "Monitor and counsel; coordinate with parents.", termId: tid, category: cats[(have + k) % cats.length], confidentialityLevel: "restricted" as const });
      }
      for (let i = 0; i < rows.length; i += 500) await prisma.anecdotalRecord.createMany({ data: rows, skipDuplicates: true });
    }
  }
  const anecAll = await prisma.anecdotalRecord.findMany({ select: { id: true, observerId: true, studentId: true, rosterId: true, termId: true } });

  await topupSimple("AnecdotalFolder(100+)", await prisma.anecdotalFolder.count(), (need, off) => Array.from({ length: need }, (_, k) => ({ id: keyId("s100_af", `${owners[(off + k) % Math.max(1, owners.length)]?.id.slice(-6) ?? "x"}_${off + k}`), ownerId: owners[(off + k) % Math.max(1, owners.length)]?.id ?? createdBy, name: `Seed100 folder ${(off + k) % 12 + 1}` })), async (rows) => (await prisma.anecdotalFolder.createMany({ data: rows, skipDuplicates: true })).count);

  {
    const have = await prisma.anecdotalRecordFollowup.count();
    const need = Math.max(0, Math.max(MIN, Math.min(150, anecAll.length)) - have);
    note("AnecdotalFollowup(150)", have, need);
    if (!DRY && need > 0 && anecAll.length) {
      const rows = Array.from({ length: need }, (_, k) => { const a = anecAll[(have + k) % anecAll.length]; const se = termStartEnd.get(a.termId) ?? { s: new Date("2026-06-08"), e: new Date("2026-12-18") }; return { id: keyId("s100_afu", `${a.id.slice(-8)}_${have + k}`), anecdotalRecordId: a.id, followupBy: owners[(have + k) % Math.max(1, owners.length)]?.id ?? a.observerId, followupDate: inTermDateFor(se.s, se.e, have + k + 29), notes: "Followed up with student and parents; documented progress." }; });
      for (let i = 0; i < rows.length; i += 500) await prisma.anecdotalRecordFollowup.createMany({ data: rows.slice(i, i + 500), skipDuplicates: true });
    }
  }

  // ---- referrals (need 130: 70 roster + 60 student for ADM chain) ----
  {
    const have = await prisma.referral.count();
    const need = Math.max(0, 130 - have);
    note("Referral(130)", have, need);
    if (!DRY && need > 0 && anecAll.length) {
      const targets = ["guidance_counselor", "nurse", "adm_coordinator"] as const;
      const stats = ["pending", "in_progress", "resolved"] as const;
      const rows = Array.from({ length: need }, (_, k) => { const a = anecAll[(have + k) % anecAll.length]; return { id: keyId("s100_ref", `${a.id.slice(-8)}_${have + k}`), anecdotalRecordId: a.id, referredToRole: targets[(have + k) % targets.length], referredBy: a.observerId, reason: "Behavioral/academic concern requiring specialist review.", status: stats[(have + k) % stats.length], studentId: a.studentId, rosterId: a.rosterId, termId: a.termId }; });
      for (let i = 0; i < rows.length; i += 500) await prisma.referral.createMany({ data: rows.slice(i, i + 500), skipDuplicates: true });
    }
  }
  const refs = await prisma.referral.findMany({ select: { id: true, termId: true } });

  await topupSimple("CounselingSession(100+)", await prisma.counselingSession.count(), (need, off) => { const types = ["individual", "parent_conference", "group", "home_visit"]; const st = ["scheduled", "completed", "cancelled"]; return Array.from({ length: need }, (_, k) => ({ id: keyId("s100_cs", `${refs[(off + k) % Math.max(1, refs.length)]?.id.slice(-6) ?? "x"}_${off + k}`), referralId: refs[(off + k) % Math.max(1, refs.length)]?.id, sessionType: types[(off + k) % types.length], scheduledAt: new Date(Date.now() - (off + k) * 86400000), venue: "Guidance office", status: st[(off + k) % st.length], sessionNotes: (off + k) % 3 === 1 ? "Session completed with action items." : null, createdBy: guidance?.id ?? createdBy })); }, async (rows) => (await prisma.counselingSession.createMany({ data: rows.filter(r => r.referralId), skipDuplicates: true })).count);
  const sessions = await prisma.counselingSession.findMany({ select: { id: true } });
  await topupSimple("ClinicAttachment(100+)", await prisma.clinicSessionAttachment.count(), (need, off) => Array.from({ length: need }, (_, k) => ({ id: keyId("s100_csa", `${sessions[(off + k) % Math.max(1, sessions.length)]?.id.slice(-6) ?? "x"}_${off + k}`), sessionId: sessions[(off + k) % Math.max(1, sessions.length)]?.id ?? "dry", fileUrl: `https://example.com/s100/session-${off + k}.jpg`, fileName: `session-${off + k}.jpg`, mimeType: "image/jpeg", fileSize: 1024 * (20 + ((off + k) % 80)), uploadedBy: nurse?.id ?? createdBy })), async (rows) => (await prisma.clinicSessionAttachment.createMany({ data: rows.filter(r => r.sessionId !== "dry"), skipDuplicates: true })).count);

  // ---- interventions ----
  {
    const have = await prisma.intervention.count();
    const need = Math.max(0, 120 - have);
    note("Intervention(120)", have, need);
    if (!DRY && need > 0) {
      const rows: any[] = [];
      for (let k = 0; k < need; k++) {
        const useStudent = k % 3 === 0 && prof2.length > 0;
        const r = useStudent ? null : roster2[(have + k) % Math.max(1, roster2.length)];
        const p = useStudent ? prof2[(have + k) % prof2.length] : null;
        rows.push({ id: keyId("s100_iv", `${have + k}_${(r?.id ?? p!.userId).slice(-6)}`), ...(r ? { rosterId: r.id } : { studentId: p!.userId }), riskLevelAtFlag: (["Low", "Moderate", "High"] as const)[(have + k) % 3], recommendedAction: "Counseling + behavior contract + attendance monitoring.", assignedTo: guidance?.id ?? createdBy, assignedAt: new Date(), approvalStatus: "approved" as const, outcomeStatus: (["ongoing", "resolved", "unresolved"] as const)[(have + k) % 3], termId: pickTerm(have + k) });
      }
      for (let i = 0; i < rows.length; i += 500) await prisma.intervention.createMany({ data: rows.slice(i, i + 500), skipDuplicates: true });
    }
  }

  // ---- health + home (studentId required) ----
  await topupSimple("HealthRecord(110)", await prisma.healthRecord.count(), (need, off) => Array.from({ length: need }, (_, k) => { const p = prof2[(off + k) % Math.max(1, prof2.length)]; const tid = pickTerm(off + k); const se = termStartEnd.get(tid)!; return { id: keyId("s100_hr", `${p?.userId.slice(-6) ?? "x"}_${off + k}`), studentId: p?.userId ?? "dry", visitDatetime: inTermDateFor(se.s, se.e, off + k + 41), complaint: COMPLAINTS[(off + k) % COMPLAINTS.length], diagnosis: DIAGNOSES[(off + k) % DIAGNOSES.length], treatmentGiven: "First aid + rest + parent advice.", recordedBy: nurse?.id ?? createdBy, termId: tid, confidentialityLevel: "restricted" as const }; }), async (rows) => (await prisma.healthRecord.createMany({ data: rows.filter(r => r.studentId !== "dry"), skipDuplicates: true })).count);
  await topupSimple("HomeVisitation(110)", await prisma.homeVisitationRecord.count(), (need, off) => Array.from({ length: need }, (_, k) => { const p = prof2[(off + k) % Math.max(1, prof2.length)]; return { id: keyId("s100_hv", `${p?.userId.slice(-6) ?? "x"}_${off + k}`), studentId: p?.userId ?? "dry", personVisited: ["Mother", "Father", "Guardian"][(off + k) % 3], homeCondition: "Adequate; needs study area.", familyCondition: "Supportive.", agreements: "Family supports attendance + study schedule.", certificationBy: guidance?.id ?? createdBy, termId: pickTerm(off + k), confidentialityLevel: "restricted" as const }; }), async (rows) => (await prisma.homeVisitationRecord.createMany({ data: rows.filter(r => r.studentId !== "dry"), skipDuplicates: true })).count);

  // ---- ADM chain (100 profiles) ----
  {
    const have = await prisma.admLearnerProfile.count();
    const need = Math.max(0, MIN - have);
    note("AdmLearnerProfile(100+)", have, need);
    if (!DRY && need > 0 && prof2.length && refs.length) {
      const refsByStudent = new Map<string, string>();
      const allRefs = await prisma.referral.findMany({ select: { id: true, studentId: true } });
      for (const rf of allRefs) if (rf.studentId) refsByStudent.set(rf.studentId, rf.id);
      // ensure student referrals exist for profiles lacking one
      let created = 0;
      for (const p of prof2.slice(0, need + 5)) {
        if (refsByStudent.has(p.userId)) continue;
        const anec = anecAll.find(a => a.studentId === p.userId) ?? anecAll[created % Math.max(1, anecAll.length)];
        if (!anec) continue;
        const rid = keyId("s100_refs", `${p.userId.slice(-8)}_${created}`);
        await prisma.referral.createMany({ data: [{ id: rid, anecdotalRecordId: anec.id, referredToRole: "adm_coordinator" as const, referredBy: anec.observerId, reason: "ADM eligibility assessment.", status: "in_progress" as const, studentId: p.userId, termId: anec.termId }], skipDuplicates: true });
        refsByStudent.set(p.userId, rid); created++;
      }
      const cand = prof2.filter(p => refsByStudent.has(p.userId)).slice(0, need);
      for (let k = 0; k < cand.length; k++) {
        const p = cand[k];
        const pid = keyId("s100_adm", `${p.userId.slice(-8)}_${have + k}`);
        const tid = pickTerm(have + k);
        const se = termStartEnd.get(tid)!;
        await prisma.admLearnerProfile.upsert({
          where: { id: pid }, update: {}, create: {
            id: pid, studentId: p.userId, referralId: refsByStudent.get(p.userId)!, eligibilityStatus: (["pending", "eligible", "ineligible"] as const)[(have + k) % 3], preparedBy: admCoord?.id ?? createdBy, certificationDetails: { needs: "Modules + device", plan: "Seed100 ADM plan" }, termId: tid, confidentialityLevel: "restricted" as const,
            parentMeetings: { create: [{ recordedBy: admCoord?.id ?? createdBy, meetingDatetime: inTermDateFor(se.s, se.e, have + k + 53), attended: (have + k) % 2 === 0, minutesOfMeeting: "Discussed ADM plan + module schedule." }] },
            modules: { create: [{ moduleName: `Seed100 Module ${(have + k) % 5 + 1}`, releaseDate: inTermDateFor(se.s, se.e, have + k + 55), dueDate: inTermDateFor(se.s, se.e, have + k + 60), submitted: (have + k) % 2 === 0, recordedBy: admCoord?.id ?? createdBy }] },
            devices: { create: [{ deviceType: "Tablet", deviceSerial: `S100SN${have + k}${(have + k) % 997}`, issuedBy: admCoord?.id ?? createdBy, issuedDate: inTermDateFor(se.s, se.e, have + k + 57) }] },
            forms: { create: [{ formType: "REFERRAL_FORM" as const, title: "Referral Form", status: "verified" as const, uploadedBy: admCoord?.id ?? createdBy, notes: "Seed100 ADM form." }] },
          },
        });
      }
    }
  }
  const admProfiles = await prisma.admLearnerProfile.findMany({ select: { id: true } });
  const meetings0 = await prisma.admParentMeeting.findMany({ select: { id: true } });
  await topupSimple("AdmParentMeeting(100+)", meetings0.length, (need, off) => Array.from({ length: need }, (_, k) => ({ id: keyId("s100_apm", `${refs[(off + k) % Math.max(1, refs.length)]?.id.slice(-6) ?? "x"}_${off + k}`), referralId: refs[(off + k) % Math.max(1, refs.length)]?.id, recordedBy: admCoord?.id ?? createdBy, meetingDatetime: new Date(Date.now() - (off + k) * 3600000), attended: (off + k) % 2 === 0, minutesOfMeeting: "Seed100 parent meeting." })), async (rows) => (await prisma.admParentMeeting.createMany({ data: rows.filter(r => r.referralId), skipDuplicates: true })).count);
  const meetings = await prisma.admParentMeeting.findMany({ select: { id: true } });
  {
    const have = await prisma.admMeetingInvitee.count();
    const need = Math.max(0, MIN - have);
    note("AdmMeetingInvitee(100+)", have, need);
    if (!DRY && need > 0 && meetings.length) {
      const pool = [guidance?.id, nurse?.id, admCoord?.id, ...advisers.slice(0, 3).map(a => a.id)].filter(Boolean) as string[];
      const rows: any[] = []; let k = 0, guard = 0;
      while (rows.length < need && guard < need * 10) { const m = meetings[(have + k) % meetings.length]; const u = pool[k % pool.length]; rows.push({ id: keyId("s100_ami", `${m.id.slice(-6)}_${u.slice(-6)}_${have + k}`), meetingId: m.id, userId: u }); k++; guard++; }
      // dedupe pairs
      const seen = new Set<string>(); const ded = rows.filter(r => (seen.has(`${r.meetingId}|${r.userId}`) ? false : (seen.add(`${r.meetingId}|${r.userId}`), true)));
      for (let i = 0; i < ded.slice(0, need).length; i += 500) await prisma.admMeetingInvitee.createMany({ data: ded.slice(i, i + 500), skipDuplicates: true });
    }
  }
  await topupSimple("AdmMeetingAttachment(100+)", await prisma.admMeetingAttachment.count(), (need, off) => Array.from({ length: need }, (_, k) => ({ id: keyId("s100_ama", `${meetings[(off + k) % Math.max(1, meetings.length)]?.id.slice(-6) ?? "x"}_${off + k}`), meetingId: meetings[(off + k) % Math.max(1, meetings.length)]?.id ?? "dry", fileUrl: `https://example.com/s100/meeting-${off + k}.jpg`, fileName: `meeting-${off + k}.jpg`, mimeType: "image/jpeg", fileSize: 1024 * (10 + ((off + k) % 90)), uploadedBy: admCoord?.id ?? createdBy })), async (rows) => (await prisma.admMeetingAttachment.createMany({ data: rows.filter(r => r.meetingId !== "dry"), skipDuplicates: true })).count);
  await topupSimple("AdmModule(100+)", await prisma.admModule.count(), (need, off) => Array.from({ length: need }, (_, k) => ({ id: keyId("s100_mod", `${admProfiles[(off + k) % Math.max(1, admProfiles.length)]?.id.slice(-6) ?? "x"}_${off + k}`), admLearnerProfileId: admProfiles[(off + k) % Math.max(1, admProfiles.length)]?.id ?? "dry", moduleName: `Seed100 Module ${(off + k) % 8 + 1}`, releaseDate: new Date(), dueDate: new Date(), submitted: (off + k) % 2 === 0, recordedBy: admCoord?.id ?? createdBy })), async (rows) => (await prisma.admModule.createMany({ data: rows.filter(r => r.admLearnerProfileId !== "dry"), skipDuplicates: true })).count);
  await topupSimple("AdmDevice(100+)", await prisma.admDevice.count(), (need, off) => Array.from({ length: need }, (_, k) => ({ id: keyId("s100_dev", `${admProfiles[(off + k) % Math.max(1, admProfiles.length)]?.id.slice(-6) ?? "x"}_${off + k}`), admLearnerProfileId: admProfiles[(off + k) % Math.max(1, admProfiles.length)]?.id ?? "dry", deviceType: "Tablet", deviceSerial: `S100D${off + k}${(off + k) % 991}`, issuedBy: admCoord?.id ?? createdBy, issuedDate: new Date() })), async (rows) => (await prisma.admDevice.createMany({ data: rows.filter(r => r.admLearnerProfileId !== "dry"), skipDuplicates: true })).count);
  await topupSimple("AdmForm(100+)", await prisma.admForm.count(), (need, off) => { const types = ["REFERRAL_FORM", "ANECDOTAL_REPORT", "MINUTES_OF_MEETING", "HV_FORM", "CERTIFICATION"] as const; return Array.from({ length: need }, (_, k) => ({ id: keyId("s100_frm", `${admProfiles[(off + k) % Math.max(1, admProfiles.length)]?.id.slice(-6) ?? "x"}_${off + k}`), admLearnerProfileId: admProfiles[(off + k) % Math.max(1, admProfiles.length)]?.id ?? "dry", formType: types[(off + k) % types.length], title: "Seed100 form", status: "submitted" as const, uploadedBy: admCoord?.id ?? createdBy, notes: "Seed100 ADM form." })); }, async (rows) => (await prisma.admForm.createMany({ data: rows.filter(r => r.admLearnerProfileId !== "dry"), skipDuplicates: true })).count);

  // ---- grade flags ----
  await topupSimple("GradeFlag(100+)", await prisma.gradeFlag.count(), (need, off) => { const reasons = ["wrong_score", "missing_assessment", "transmutation_error", "late_submission", "other"] as const; return Array.from({ length: need }, (_, k) => { const p = prof2[(off + k) % Math.max(1, prof2.length)]; const sec = secById.get(p?.sectionId ?? sections[0]?.id); return { id: keyId("s100_gf", `${p?.userId.slice(-6) ?? "x"}_${off + k}`), studentId: p?.userId ?? createdBy, subjectId: subjects[(off + k) % Math.max(1, subjects.length)]?.id ?? "dry", sectionId: sec?.id ?? sections[0]?.id ?? "dry", termId: pickTerm(off + k), reason: reasons[(off + k) % reasons.length], note: "Seed100 grade flag for review.", status: (off + k) % 4 === 3 ? "resolved" as const : "open" as const, raisedBy: teachers[(off + k) % Math.max(1, teachers.length)]?.id ?? createdBy }; }); }, async (rows) => (await prisma.gradeFlag.createMany({ data: rows.filter(r => r.subjectId !== "dry" && r.sectionId !== "dry" && prof2.length), skipDuplicates: true })).count);

  // ---- SF10 ----
  {
    const have = await prisma.sf10Record.count();
    const need = Math.max(0, 110 - have);
    note("Sf10Record(110)", have, need);
    if (!DRY && need > 0 && prof2.length) {
      const taken = new Set((await prisma.sf10Record.findMany({ select: { studentId: true } })).map(s => s.studentId));
      const rows: any[] = [];
      for (const p of prof2) {
        if (rows.length >= need) break;
        if (taken.has(p.userId)) continue;
        taken.add(p.userId);
        rows.push({ id: keyId("s100_sf10", p.userId.slice(-8)), studentId: p.userId, source: (["auto_populated", "ocr_upload", "manual"] as const)[rows.length % 3] });
      }
      for (let i = 0; i < rows.length; i += 500) await prisma.sf10Record.createMany({ data: rows.slice(i, i + 500), skipDuplicates: true });
    }
  }
  const sf10s = await prisma.sf10Record.findMany({ select: { id: true } });
  await topupSimple("Sf10Version(100+)", await prisma.sf10RecordVersion.count(), (need, off) => Array.from({ length: need }, (_, k) => ({ id: keyId("s100_sfv", `${sf10s[(off + k) % Math.max(1, sf10s.length)]?.id.slice(-6) ?? "x"}_${off + k}`), sf10RecordId: sf10s[(off + k) % Math.max(1, sf10s.length)]?.id ?? "dry", versionNumber: 1 + ((off + k) % 3), dataSnapshot: { seed100: true, seq: off + k }, changedBy: registrarUser?.id ?? createdBy, changeReason: "Seed100 version history." })), async (rows) => (await prisma.sf10RecordVersion.createMany({ data: rows.filter(r => r.sf10RecordId !== "dry"), skipDuplicates: true })).count);

  await topupSimple("Sf10AccessRequest(100+)", await prisma.adviserSf10AccessRequest.count(), (need, off) => { const sts = ["pending", "approved", "denied"] as const; return Array.from({ length: need }, (_, k) => { const sec = sections[(off + k) % Math.max(1, sections.length)]; const st = sts[(off + k) % sts.length]; return { id: keyId("s100_asr", `${sec?.id.slice(-6) ?? "x"}_${off + k}`), adviserId: advisers[(off + k) % Math.max(1, advisers.length)]?.id ?? createdBy, sectionId: sec?.id ?? "dry", gradeLevel: sec?.gradeLevel ?? "G7", reason: "Seed100 SF10 review for division endorsement.", status: st, decidedBy: st === "pending" ? null : registrarUser?.id ?? createdBy, decidedAt: st === "pending" ? null : new Date() }; }); }, async (rows) => (await prisma.adviserSf10AccessRequest.createMany({ data: rows.filter(r => r.sectionId !== "dry"), skipDuplicates: true })).count);
  await topupSimple("ArchivedStudent(100+)", await prisma.adviserArchivedStudent.count(), (need, off) => Array.from({ length: need }, (_, k) => ({ id: keyId("s100_aas", `${advisers[(off + k) % Math.max(1, advisers.length)]?.id.slice(-4) ?? "x"}_${roster2[(off + k) % Math.max(1, roster2.length)]?.id.slice(-4) ?? "x"}_${off + k}`), teacherId: advisers[(off + k) % Math.max(1, advisers.length)]?.id ?? createdBy, rosterId: roster2[(off + k) % Math.max(1, roster2.length)]?.id })), async (rows) => (await prisma.adviserArchivedStudent.createMany({ data: rows.filter(r => r.rosterId), skipDuplicates: true })).count);

  // ---- teacher names / grants / timetable / schedule ----
  await topupSimple("TeacherName(100+)", await prisma.teacherName.count(), (need, off) => Array.from({ length: need }, (_, k) => ({ id: keyId("s100_tn", `name_${off + k}`), name: `Seed100 Catalog Teacher ${off + k + 1}`, code: `S100-${off + k + 1}` })), async (rows) => (await prisma.teacherName.createMany({ data: rows, skipDuplicates: true })).count);
  {
    const have = await prisma.teacherTermGrant.count();
    const need = Math.max(0, MIN - have);
    note("TeacherTermGrant(100+)", have, need);
    if (!DRY && need > 0) {
      const pool = [...teachers, ...advisers];
      const exist = new Set((await prisma.teacherTermGrant.findMany({ select: { userId: true, termId: true } })).map(e => `${e.userId}::${e.termId}`));
      const rows: any[] = []; let ti = 0;
      while (rows.length < need && ti < pool.length * termsAll.length + 10) {
        const u = pool[ti % Math.max(1, pool.length)]; const tm = termsAll[Math.floor(ti / Math.max(1, pool.length)) % Math.max(1, termsAll.length)];
        if (u && tm && !exist.has(`${u.id}::${tm.id}`)) { exist.add(`${u.id}::${tm.id}`); rows.push({ id: keyId("s100_ttg", `${u.id.slice(-6)}_${tm.termNumber}`), userId: u.id, termId: tm.id, via: ti % 2 === 0 ? "adviser" : "code" }); }
        ti++;
        if (ti > 5000) break;
      }
      for (let i = 0; i < rows.length; i += 500) await prisma.teacherTermGrant.createMany({ data: rows.slice(i, i + 500), skipDuplicates: true });
    }
  }
  {
    const have = await prisma.scheduleConfig.count();
    note("ScheduleConfig(capped=terms)", have, 0);
    if (!DRY) for (const t of termsAll) await prisma.scheduleConfig.upsert({ where: { termId: t.id }, update: {}, create: { termId: t.id } });
  }
  {
    const have = await prisma.sectionTimetableEntry.count();
    const target = Math.max(MIN, sections.length * 2 * 5);
    const need = Math.max(0, target - have);
    note("TimetableEntry(180)", have, need);
    if (!DRY && need > 0 && sections.length && subjects.length) {
      const names = await prisma.teacherName.findMany({ select: { id: true }, take: 50 });
      const rows: any[] = []; let k = 0;
      outer: for (const term of gradeTerms) for (const sec of sections) for (let d = 1; d <= 5; d++) {
        if (rows.length >= need) break outer;
        const pool = subjects.filter(s => s.gradeLevel === sec.gradeLevel);
        if (!pool.length) continue;
        const subj = pool[(k + d) % pool.length];
        rows.push({ id: keyId("s100_tte", `${sec.name}_T${term.termNumber}_${d}_${k}`), sectionId: sec.id, subjectId: subj.id, termId: term.id, day: d, period: 0, teacherNameId: names.length ? names[k % names.length].id : null, status: "APPROVED" as const });
        k++;
      }
      // dedupe (section,term,day,period)
      const seen = new Set<string>(); const ded = rows.filter(r => (seen.has(`${r.sectionId}|${r.termId}|${r.day}|${r.period}`) ? false : (seen.add(`${r.sectionId}|${r.termId}|${r.day}|${r.period}`), true)));
      for (let i = 0; i < ded.length; i += 500) await prisma.sectionTimetableEntry.createMany({ data: ded.slice(i, i + 500), skipDuplicates: true });
    }
  }

  // ---- risk snapshots (direct, deterministic from finals avg) ----
  {
    const have = await prisma.riskSnapshot.count();
    const target = Math.max(300, roster2.length + Math.min(120, prof2.length));
    const need = Math.max(0, target - have);
    note("RiskSnapshot(840+)", have, need);
    if (!DRY && need > 0 && t1id) {
      const finals = await prisma.finalGrade.findMany({ where: { termId: t1id }, select: { rosterId: true, studentId: true, transmutedGrade: true } });
      const avgByRoster = new Map<string, number[]>();
      const avgByStudent = new Map<string, number[]>();
      for (const f of finals) {
        if (f.rosterId) { const a = avgByRoster.get(f.rosterId) ?? []; a.push(f.transmutedGrade ?? 75); avgByRoster.set(f.rosterId, a); }
        if (f.studentId) { const a = avgByStudent.get(f.studentId) ?? []; a.push(f.transmutedGrade ?? 75); avgByStudent.set(f.studentId, a); }
      }
      const anecRoster = await prisma.anecdotalRecord.groupBy({ by: ["rosterId"], where: { termId: t1id, rosterId: { not: null } }, _count: { _all: true } });
      const anecSet = new Set(anecRoster.map(a => a.rosterId));
      const rows: any[] = []; let i = 0;
      for (const r of roster2) {
        if (rows.length >= need) break;
        const avgs = avgByRoster.get(r.id) ?? [];
        const avg = avgs.length ? avgs.reduce((x, y) => x + y, 0) / avgs.length : 80;
        const acad = avg < 75 ? 1 : 0;
        const beh = anecSet.has(r.id) ? 1 : (hash01(`beh_${r.id}`) < 0.15 ? 1 : 0);
        const att = hash01(`attflag_${r.id}`) < 0.12 ? 1 : 0;
        const cnt = acad + beh + att;
        rows.push({ id: keyId("s100_rs", `${r.id.slice(-6)}_t1`), rosterId: r.id, riskLevel: (cnt >= 2 ? "High" : cnt === 1 ? "Moderate" : "Low") as const, riskCount: cnt, termId: t1id });
        i++;
      }
      for (const p of prof2.slice(0, Math.min(120, need - rows.length))) {
        const avgs = avgByStudent.get(p.userId) ?? [];
        const avg = avgs.length ? avgs.reduce((x, y) => x + y, 0) / avgs.length : 82;
        const cnt = (avg < 75 ? 1 : 0) + (hash01(`pbeh_${p.userId}`) < 0.2 ? 1 : 0);
        rows.push({ id: keyId("s100_rsp", `${p.userId.slice(-6)}_t1`), studentId: p.userId, riskLevel: (cnt >= 2 ? "High" : cnt === 1 ? "Moderate" : "Low") as const, riskCount: cnt, termId: t1id });
      }
      for (let j = 0; j < rows.slice(0, need).length; j += 500) await prisma.riskSnapshot.createMany({ data: rows.slice(j, j + 500), skipDuplicates: true });
    }
  }

  await topupSimple("ReportSnapshot(100+)", await prisma.reportSnapshot.count(), (need, off) => { const types = ["trends", "intervention_success", "heat_map", "honor_roll"]; const scopes = ["school", "grade", "section"]; return Array.from({ length: need }, (_, k) => ({ id: keyId("s100_rp", `snap_${off + k}`), reportType: types[(off + k) % types.length], scope: scopes[(off + k) % scopes.length], scopeId: (off + k) % 3 === 2 && sections.length ? sections[(off + k) % sections.length].id : null, termId: pickTerm(off + k), payload: { seed100: true, seq: off + k } })); }, async (rows) => (await prisma.reportSnapshot.createMany({ data: rows, skipDuplicates: true })).count);
  await topupSimple("AttendanceLegacy(100+)", await prisma.attendanceRecordLegacy.count(), (need, off) => Array.from({ length: need }, (_, k) => { const r = roster2[(off + k) % Math.max(1, roster2.length)]; const sec = secById.get(r?.sectionId ?? ""); return { id: keyId("s100_al", `${r?.id.slice(-6) ?? "x"}_${off + k}`), rosterId: r?.id, sectionId: sec?.id ?? sections[0]?.id ?? "dry", date: new Date(Date.now() - (off + k) * 86400000), session: (off + k) % 2 === 0 ? "AM" as const : "PM" as const, status: (["present", "absent", "late", "excused"] as const)[(off + k) % 4], recordedBy: sec?.adviserId ?? createdBy, termId: pickTerm(off + k) }; }), async (rows) => (await prisma.attendanceRecordLegacy.createMany({ data: rows.filter(r => r.rosterId && r.sectionId !== "dry"), skipDuplicates: true })).count);

  // ---- audit + notifications + refresh tokens ----
  {
    const have = await prisma.auditLog.count();
    const need = Math.max(0, 250 - have);
    note("AuditLog(250+)", have, need);
    if (!DRY && need > 0) {
      const acts = ["account_approval", "grade_lock", "grade_unlock", "referral_status_change", "intervention_approval", "create", "update"] as const;
      const srcs = [...roster2.slice(0, 50).map(r => ({ t: "StudentRoster", id: r.id })), ...prof2.slice(0, 30).map(p => ({ t: "StudentProfile", id: p.userId }))];
      const rows = Array.from({ length: need }, (_, k) => ({ id: keyId("s100_alog", `${have + k}`), userId: (owners[(have + k) % Math.max(1, owners.length)]?.id ?? createdBy), actionType: acts[(have + k) % acts.length] as any, sourceTable: srcs.length ? srcs[(have + k) % srcs.length].t : "StudentRoster", sourceId: srcs.length ? srcs[(have + k) % srcs.length].id : createdBy, reason: "Seed100 audit entry." }));
      for (let i = 0; i < rows.length; i += 500) await prisma.auditLog.createMany({ data: rows.slice(i, i + 500), skipDuplicates: true });
    }
  }
  {
    const have = await prisma.notification.count();
    const need = Math.max(0, 200 - have);
    note("Notification(200+)", have, need);
    if (!DRY && need > 0) {
      const users = await prisma.user.findMany({ select: { id: true }, take: 300 });
      const pool = users.length ? users : [{ id: createdBy }];
      const rows = Array.from({ length: need }, (_, k) => ({ id: keyId("s100_nt", `${have + k}`), userId: pool[(have + k) % pool.length].id, type: ["attendance_alert", "grade_posted", "referral_update", "adm_update"][(have + k) % 4], sourceTable: "AttendanceRecord", sourceId: roster2[(have + k) % Math.max(1, roster2.length)]?.id ?? createdBy, channel: ["web", "mobile"] as any, message: "Seed100 notification: please review your records.", isRead: false }));
      for (let i = 0; i < rows.length; i += 500) await prisma.notification.createMany({ data: rows.slice(i, i + 500), skipDuplicates: true });
    }
  }
  {
    const have = await prisma.refreshToken.count();
    const need = Math.max(0, MIN - have);
    note("RefreshToken(100+)", have, need);
    if (!DRY && need > 0) {
      const users = await prisma.user.findMany({ select: { id: true }, take: 200 });
      const pool = users.length ? users : [{ id: createdBy }];
      const rows: any[] = []; let k = 0;
      while (rows.length < need && k < need * 5) { const u = pool[(k) % pool.length]; rows.push({ id: keyId("s100_rt", `${u.id.slice(-6)}_${k}`), userId: u.id, tokenHash: `s100hash_${u.id.slice(-8)}_${k}_${Date.now() % 100000}`, expiresAt: new Date(Date.now() + 7 * 86400000) }); k++; }
      for (let i = 0; i < rows.length; i += 500) await prisma.refreshToken.createMany({ data: rows.slice(i, i + 500), skipDuplicates: true });
    }
  }

  console.log(DRY ? "DRY-RUN plan (no writes):" : "Seed100 result (have -> +add):");
  console.log("table,have,add");
  for (const p of plan) console.log(`${p.table},${p.have},${p.add}`);
  console.log("NOTE: Subject/Section/GradeComponent/ScheduleConfig capped by schema or 3-per-grade rule (waived).");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
