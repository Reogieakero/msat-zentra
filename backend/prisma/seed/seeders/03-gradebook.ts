import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { ASM_PER_COMPONENT, T2_CUTOFF, DRY, weightsFor } from "../config.js";
import type { CoreCtx } from "./00-core.js";
import type { AcademicCtx } from "./01-academic.js";
import type { RosterCtx } from "./02-roster.js";
import type { Rng } from "../utils/rng.js";
import { keyId } from "../utils/rng.js";
import { inTermDate } from "../utils/calendar.js";
import { Batcher, bulkCreate } from "../utils/chunk.js";

// Local copy of DepEd transmutation + weighted computation (mirrors src/services/grading.ts).
const TRANSMUTATION: { min: number; grade: number }[] = [
  { min: 100, grade: 100 }, { min: 98.4, grade: 99 }, { min: 96.8, grade: 98 },
  { min: 95.2, grade: 97 }, { min: 93.6, grade: 96 }, { min: 92.0, grade: 95 },
  { min: 90.4, grade: 94 }, { min: 88.8, grade: 93 }, { min: 87.2, grade: 92 },
  { min: 85.6, grade: 91 }, { min: 84.0, grade: 90 }, { min: 82.4, grade: 89 },
  { min: 80.8, grade: 88 }, { min: 79.2, grade: 87 }, { min: 77.6, grade: 86 },
  { min: 76.0, grade: 85 }, { min: 74.4, grade: 84 }, { min: 72.8, grade: 83 },
  { min: 71.2, grade: 82 }, { min: 69.6, grade: 81 }, { min: 68.0, grade: 80 },
  { min: 66.4, grade: 79 }, { min: 64.8, grade: 78 }, { min: 63.2, grade: 77 },
  { min: 61.6, grade: 76 }, { min: 60.0, grade: 75 }, { min: 56.0, grade: 74 },
  { min: 52.0, grade: 73 }, { min: 48.0, grade: 72 }, { min: 44.0, grade: 71 },
  { min: 40.0, grade: 70 }, { min: 36.0, grade: 69 }, { min: 32.0, grade: 68 },
  { min: 28.0, grade: 67 }, { min: 24.0, grade: 66 }, { min: 20.0, grade: 65 },
  { min: 16.0, grade: 64 }, { min: 12.0, grade: 63 }, { min: 8.0, grade: 62 },
  { min: 4.0, grade: 61 }, { min: 0, grade: 60 },
];
function transmute(v: number): number {
  const c = Math.min(100, Math.max(0, v));
  for (const r of TRANSMUTATION) if (c >= r.min) return r.grade;
  return 60;
}

export interface GradebookCtx {
  assessments: { id: string; maxScore: number; componentType: string; subjectId: string; termId: string; dateGiven: Date; gradeLevel: string }[];
  // Evidence for risk phase: studentKey -> avg transmuted (filled after finals).
  avgTransmuted: Map<string, Map<string, number[]>>; // termId -> studentKey -> grades
}

export async function seedGradebook(
  prisma: PrismaClient,
  core: CoreCtx,
  acad: AcademicCtx,
  roster: RosterCtx,
  rng: Rng,
): Promise<GradebookCtx> {
  const termById = new Map(core.termIds.map((t) => [t.id, t]));
  // ---- GradeComponent ----
  if (!DRY) {
    for (const term of [core.t1Id, core.t2Id]) {
      for (const subj of acad.subjects) {
        const w = weightsFor(subj.gradeLevel, subj.code);
        const defs = [
          { t: "WRITTEN_WORK", w: w.WW },
          { t: "PERFORMANCE_TASK", w: w.PT },
          { t: "EXAM", w: w.EXAM },
        ] as const;
        for (const d of defs) {
          await prisma.gradeComponent.upsert({
            where: { subjectId_termId_componentType: { subjectId: subj.id, termId: term, componentType: d.t as any } },
            update: { weightPercentage: d.w },
            create: { subjectId: subj.id, termId: term, componentType: d.t as any, weightPercentage: d.w },
          });
        }
      }
    }
  }
  const comps = await prisma.gradeComponent.findMany({
    where: { termId: { in: [core.t1Id, core.t2Id] } },
    select: { id: true, subjectId: true, termId: true, componentType: true, weightPercentage: true },
  });
  const compByKey = new Map(comps.map((c) => [`${c.subjectId}|${c.termId}|${c.componentType}`, c]));
  const subjOf = new Map(acad.subjects.map((s) => [s.id, s]));

  // Assignment teacher per subject+term (for createdBy).
  const teacherForSubjectTerm = new Map<string, string>();
  for (const a of acad.assignments) {
    const k = `${a.subjectId}|${a.termId}`;
    if (!teacherForSubjectTerm.has(k)) teacherForSubjectTerm.set(k, a.teacherId);
  }

  // ---- Assessments ----
  const assessments: GradebookCtx["assessments"] = [];
  if (!DRY) {
    const rows: any[] = [];
    for (const comp of comps) {
      const subj = subjOf.get(comp.subjectId);
      if (!subj) continue;
      const term = termById.get(comp.termId);
      if (!term) continue;
      const n = (ASM_PER_COMPONENT as any)[comp.componentType] ?? 2;
      const maxScore = comp.componentType === "WRITTEN_WORK" ? 50 : 100;
      for (let i = 1; i <= n; i++) {
        const title = comp.componentType === "WRITTEN_WORK" ? `Quiz ${i}` : comp.componentType === "PERFORMANCE_TASK" ? `Task ${i}` : `Quarterly Exam`;
        // Date distribution: WW early, PT mid, EXAM late.
        let dateGiven: Date;
        if (comp.termId === core.t1Id) {
          if (comp.componentType === "WRITTEN_WORK") dateGiven = new Date(Date.UTC(2026, 5 + (i % 2), 10 + i * 7, 8));
          else if (comp.componentType === "PERFORMANCE_TASK") dateGiven = new Date(Date.UTC(2026, 6 + (i % 2), 5 + i * 8, 8));
          else dateGiven = new Date(Date.UTC(2026, 8, 1 + i * 4, 8));
        } else {
          // T2: WW Sep16-Oct5 (graded), PT Oct1-11 (partial), EXAM Dec (future, ungraded).
          if (comp.componentType === "WRITTEN_WORK") dateGiven = new Date(Date.UTC(2026, 8, 16 + i * 5, 8));
          else if (comp.componentType === "PERFORMANCE_TASK") dateGiven = new Date(Date.UTC(2026, 9, 1 + i * 3, 8));
          else dateGiven = new Date(Date.UTC(2026, 11, 10, 8));
        }
        // Clamp inside term bounds.
        if (dateGiven < term.start) dateGiven = inTermDate(rng, term.start, term.end, comp.termId === core.t2Id ? T2_CUTOFF : undefined);
        rows.push({
          id: keyId("asm", `${subj.code}_${termById.get(comp.termId)?.n}_${comp.componentType}_${i}`),
          gradeComponentId: comp.id,
          title: `${subj.code} ${title}`,
          maxScore,
          dateGiven,
          createdBy: teacherForSubjectTerm.get(`${comp.subjectId}|${comp.termId}`) ?? core.principalId,
        });
      }
    }
    await bulkCreate("Assessments", rows.length, (ch) => prisma.assessment.createMany({ data: ch, skipDuplicates: true }) as any, rows, 1000);
  }
  const asmRows = await prisma.assessment.findMany({
    where: { gradeComponent: { termId: { in: [core.t1Id, core.t2Id] } } },
    select: { id: true, maxScore: true, dateGiven: true, gradeComponent: { select: { componentType: true, subjectId: true, termId: true } } },
  });
  for (const a of asmRows) {
    const subj = subjOf.get(a.gradeComponent.subjectId);
    assessments.push({
      id: a.id,
      maxScore: a.maxScore,
      componentType: a.gradeComponent.componentType,
      subjectId: a.gradeComponent.subjectId,
      termId: a.gradeComponent.termId,
      dateGiven: a.dateGiven,
      gradeLevel: subj?.gradeLevel ?? "G7",
    });
  }

  // ---- Student lists by grade ----
  const rosterByGrade = new Map<string, typeof roster.rosterAll>();
  for (const r of roster.rosterAll) {
    const a = rosterByGrade.get(r.gradeLevel) ?? [];
    a.push(r);
    rosterByGrade.set(r.gradeLevel, a);
  }
  const profileByGrade = new Map<string, typeof roster.profiles>();
  for (const p of roster.profiles) {
    const a = profileByGrade.get(p.gradeLevel) ?? [];
    a.push(p);
    profileByGrade.set(p.gradeLevel, a);
  }
  // Quick lookup: rosterId -> profile userId via LRN.
  const userIdByRosterId = new Map<string, string | null>();
  const lrnToUser = new Map(roster.profiles.map((p) => [p.lrn, p.userId]));
  for (const r of roster.rosterAll) userIdByRosterId.set(r.id, lrnToUser.get(r.lrn) ?? null);

  // Missing-component edge cases: studentKey|subject|term -> skip WW/PT/EXAM entirely (2%/2%/1%).
  const skipComponent = new Set<string>();
  const allKeys: string[] = [
    ...roster.rosterAll.map((r) => `R:${r.id}`),
    ...roster.profiles.map((p) => `S:${p.userId}`),
  ];
  // Deterministic 2% sampling without storing all combos: hash check at generation time.
  function shouldSkipComponent(studentKey: string, subjectId: string, termId: string, ctype: string): boolean {
    let h = 7;
    const s = `${studentKey}|${subjectId}|${termId}|${ctype}`;
    for (let i = 0; i < s.length; i++) {
      h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
    }
    const f = ((h >>> 0) % 1000) / 1000;
    if (ctype === "WRITTEN_WORK") return f < 0.02;
    if (ctype === "PERFORMANCE_TASK") return f < 0.02;
    return f < 0.01;
  }
  void skipComponent;

  // Evidence accumulator: key `${kind}:${id}|${subjectId}|${termId}|${ctype}` -> {earned, possible, count, encoded, weight}
  const evidence = new Map<string, { earned: number; possible: number; count: number; encoded: number; weight: number }>();
  for (const comp of comps) {
    const subj = subjOf.get(comp.subjectId);
    if (!subj) continue;
    const count = assessments.filter((a) => a.subjectId === comp.subjectId && a.termId === comp.termId && a.componentType === comp.componentType).length;
    // Pre-fill counts per student later during grade gen (avoid huge map init).
    void count;
  }
  const compCountBySubjTermType = new Map<string, number>();
  for (const a of assessments) {
    const k = `${a.subjectId}|${a.termId}|${a.componentType}`;
    compCountBySubjTermType.set(k, (compCountBySubjTermType.get(k) ?? 0) + 1);
  }
  const weightBySubjTermType = new Map<string, number>();
  for (const c of comps) weightBySubjTermType.set(`${c.subjectId}|${c.termId}|${c.componentType}`, c.weightPercentage);

  // ---- StudentGrade generation (streamed) ----
  const gradeBatcher = new Batcher("StudentGrades", 2000, (ch) => prisma.studentGrade.createMany({ data: ch }) as any);
  if (!DRY) {
    // Sort assessments by date for realistic encoding order.
    const sorted = [...assessments].sort((a, b) => a.dateGiven.getTime() - b.dateGiven.getTime());
    for (const asm of sorted) {
      const isT2 = asm.termId === core.t2Id;
      const isFuture = asm.dateGiven > T2_CUTOFF && isT2;
      // Future T2 EXAM: skip entirely (no grades yet).
      if (isFuture) continue;
      const rosterList = rosterByGrade.get(asm.gradeLevel) ?? [];
      // Split roster-only vs profile-backed: profile students use studentId, others rosterId.
      for (const r of rosterList) {
        const studentUserId = userIdByRosterId.get(r.id);
        const useStudentId = !!studentUserId;
        const studentKey = useStudentId ? `S:${studentUserId}` : `R:${r.id}`;
        const ab = roster.rosterAbility.get(r.id) ?? { ability: 0.7, attendRate: 0.9 };

        if (shouldSkipComponent(studentKey, asm.subjectId, asm.termId, asm.componentType)) continue;

        // Missing rates: base 3% + struggling extra + T2 late partial 40%.
        const isLateT2 = isT2 && asm.dateGiven > new Date("2026-10-05T00:00:00Z");
        let missP = 0.03 + (ab.ability < 0.4 ? 0.03 : 0);
        if (isLateT2) missP = 0.45;
        // Deterministic miss via hash of asm+student (stable, no rng state drift).
        let h = 13;
        const ms = `${asm.id}|${studentKey}`;
        for (let i = 0; i < ms.length; i++) h = (Math.imul(h, 31) + ms.charCodeAt(i)) | 0;
        if (((h >>> 0) % 1000) / 1000 < missP) continue;

        const pct = Math.min(100, Math.max(5, ab.ability * 100 + rng.gaussian() * 8));
        const pctR = Math.round(pct * 10) / 10;
        const raw = Math.round(((pctR / 100) * asm.maxScore) * 10) / 10;
        const row: any = { assessmentId: asm.id, rawScore: raw, percentageScore: pctR };
        if (useStudentId) row.studentId = studentUserId;
        else row.rosterId = r.id;
        await gradeBatcher.push(row);

        // Evidence accumulate.
        const ek = `${studentKey}|${asm.subjectId}|${asm.termId}|${asm.componentType}`;
        let ev = evidence.get(ek);
        if (!ev) {
          ev = { earned: 0, possible: 0, count: compCountBySubjTermType.get(`${asm.subjectId}|${asm.termId}|${asm.componentType}`) ?? 1, encoded: 0, weight: weightBySubjTermType.get(`${asm.subjectId}|${asm.termId}|${asm.componentType}`) ?? 0 };
          evidence.set(ek, ev);
        }
        ev.earned += raw;
        ev.possible += asm.maxScore;
        ev.encoded += 1;
      }
    }
    await gradeBatcher.finish();
  }

  // ---- FinalGrade computation from evidence ----
  const avgTransmuted = new Map<string, Map<string, number[]>>();
  if (!DRY) {
    // Group evidence by student|subject|term.
    const byStudentSubject = new Map<string, { studentKey: string; subjectId: string; termId: string; parts: { ctype: string; ev: { earned: number; possible: number; count: number; encoded: number; weight: number } }[] }>();
    for (const [ek, ev] of evidence) {
      const [studentKey, subjectId, termId, ctype] = ek.split("|");
      const gk = `${studentKey}|${subjectId}|${termId}`;
      let g = byStudentSubject.get(gk);
      if (!g) {
        g = { studentKey, subjectId, termId, parts: [] };
        byStudentSubject.set(gk, g);
      }
      g.parts.push({ ctype, ev });
    }
    const finalRows: any[] = [];
    for (const g of byStudentSubject.values()) {
      // Build CategoryEvidence for compute (only components that exist).
      const order = ["WRITTEN_WORK", "PERFORMANCE_TASK", "EXAM"];
      const cats = order.map((ctype) => {
        const found = g.parts.find((p) => p.ctype === ctype);
        const count = compCountBySubjTermType.get(`${g.subjectId}|${g.termId}|${ctype}`) ?? 0;
        if (!found) {
          return { componentType: ctype, weightPercentage: weightBySubjTermType.get(`${g.subjectId}|${g.termId}|${ctype}`) ?? 0, earned: 0, possible: 0, assessmentCount: count, encodedCount: 0 };
        }
        return { componentType: ctype, weightPercentage: found.ev.weight, earned: found.ev.earned, possible: found.ev.possible, assessmentCount: count, encodedCount: found.ev.encoded };
      });
      // Replicate computeSubjectGrade (weighted renormalisation).
      const active = cats.filter((c) => c.assessmentCount > 0);
      if (!active.length) continue;
      const availW = active.reduce((s, c) => s + c.weightPercentage, 0);
      const norm = new Map<string, number>();
      for (const c of active) norm.set(c.componentType, availW > 0 ? (c.weightPercentage * 100) / availW : 100 / active.length);
      const evidenced = active.filter((c) => c.encodedCount > 0 && c.possible > 0);
      if (!evidenced.length) continue;
      let scale = evidenced.reduce((s, c) => s + (norm.get(c.componentType) ?? 0), 0);
      if (scale <= 0) scale = 100;
      let rawGrade = 0;
      for (const c of evidenced) {
        const pct = (c.earned / c.possible) * 100;
        rawGrade += (pct * (norm.get(c.componentType) ?? 0)) / scale;
      }
      const computedAverage = Math.round(rawGrade * 100) / 100;
      const transmutedGrade = transmute(computedAverage);
      const remarks = transmutedGrade >= 75 ? "Passed" : "Failed";

      const isT1 = g.termId === core.t1Id;
      const roll = rng.next();
      const lockStatus = isT1 ? (roll < 0.7 ? "adviser_approved" : roll < 0.9 ? "locked" : "unlocked") : roll < 0.8 ? "unlocked" : roll < 0.95 ? "locked" : "adviser_approved";

      const row: any = { subjectId: g.subjectId, termId: g.termId, computedAverage, transmutedGrade, remarks, lockStatus };
      if (lockStatus !== "unlocked") {
        row.lockedAt = isT1 ? new Date("2026-09-12T00:00:00Z") : new Date("2026-10-10T00:00:00Z");
        row.lockedBy = teacherForSubjectTerm.get(`${g.subjectId}|${g.termId}`) ?? core.principalId;
      }
      if (lockStatus === "adviser_approved") {
        row.adviserApprovedAt = isT1 ? new Date("2026-09-14T00:00:00Z") : new Date("2026-10-11T00:00:00Z");
      }
      if (g.studentKey.startsWith("S:")) row.studentId = g.studentKey.slice(2);
      else row.rosterId = g.studentKey.slice(2);
      finalRows.push(row);

      // For risk phase.
      let tm = avgTransmuted.get(g.termId);
      if (!tm) {
        tm = new Map();
        avgTransmuted.set(g.termId, tm);
      }
      const arr = tm.get(g.studentKey) ?? [];
      arr.push(transmutedGrade);
      tm.set(g.studentKey, arr);
    }
    await bulkCreate("FinalGrades", finalRows.length, (ch) => prisma.finalGrade.createMany({ data: ch }) as any, finalRows, 2000);
  }

  console.log(`Gradebook: assessments=${assessments.length}`);
  return { assessments, avgTransmuted };
}
