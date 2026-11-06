import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { DRY } from "../config.js";
import type { CoreCtx } from "./00-core.js";
import type { AcademicCtx } from "./01-academic.js";
import type { RosterCtx } from "./02-roster.js";
import type { Rng } from "../utils/rng.js";
import { keyId } from "../utils/rng.js";
import { inTermDate } from "../utils/calendar.js";
import { bulkCreate } from "../utils/chunk.js";

export async function seedSf10Flags(
  prisma: PrismaClient,
  core: CoreCtx,
  acad: AcademicCtx,
  roster: RosterCtx,
  rng: Rng,
) {
  if (DRY) return;
  const t1 = core.termIds.find((t) => t.n === 1)!;
  const registrarId = core.staff["registrar"] ?? core.principalId;

  // ---- SF10: 1 per profile ----
  {
    const existing = new Set((await prisma.sf10Record.findMany({ select: { studentId: true } })).map((s) => s.studentId));
    const rows: any[] = [];
    for (const p of roster.profiles) {
      if (existing.has(p.userId)) continue;
      const src = rng.weighted(["auto_populated", "manual", "ocr_upload"], [0.6, 0.25, 0.15]);
      const st = rng.weighted(["attach", "available", "released"], [0.2, 0.6, 0.2]);
      rows.push({
        studentId: p.userId,
        source: src as any,
        status: st as any,
        uploadedFileUrl: src !== "auto_populated" ? `https://example.com/sf10/${p.lrn}.pdf` : null,
        ocrExtractedData: src === "ocr_upload" ? { lrn: p.lrn, gradeLevel: p.gradeLevel, confidence: 0.94 } : null,
        verifiedBy: rng.next() < 0.8 ? registrarId : null,
        verifiedAt: rng.next() < 0.8 ? inTermDate(rng, t1.start, t1.end) : null,
        validatedBy: st === "released" ? registrarId : null,
        validatedAt: st === "released" ? inTermDate(rng, t1.start, t1.end) : null,
        releasedAt: st === "released" ? inTermDate(rng, t1.start, t1.end) : null,
        uploadedAt: inTermDate(rng, t1.start, t1.end),
        currentVersion: rng.weighted([1, 2, 3], [0.7, 0.2, 0.1]),
      });
    }
    await bulkCreate("Sf10", rows.length, (ch) => prisma.sf10Record.createMany({ data: ch, skipDuplicates: true }) as any, rows, 1000);
  }

  // ---- Versions: 1-2 for 30% of records ----
  {
    const recs = await prisma.sf10Record.findMany({ select: { id: true } });
    const targets = rng.shuffle(recs).slice(0, Math.floor(recs.length * 0.3));
    const rows: any[] = [];
    for (const r of targets) {
      const n = rng.next() < 0.75 ? 1 : 2;
      for (let v = 1; v <= n; v++) {
        rows.push({
          sf10RecordId: r.id,
          versionNumber: v,
          dataSnapshot: { version: v, verified: v > 1, encodedAt: new Date().toISOString() },
          changedBy: registrarId,
          changeReason: rng.pick(["Initial verification", "Correction of grades", "Re-validation after release"]),
        });
      }
    }
    await bulkCreate("Sf10Versions", rows.length, (ch) => prisma.sf10RecordVersion.createMany({ data: ch, skipDuplicates: true }) as any, rows, 1000);
  }

  // ---- Adviser SF10 access (G11/G12 only) ----
  {
    const gSecs = acad.sections.filter((s) => s.gradeLevel === "G11" || s.gradeLevel === "G12").slice(0, 20);
    const rows: any[] = gSecs.map((s, i) => {
      const st = ["pending", "approved", "denied"][i % 3] as any;
      return {
        id: keyId("asr", `${s.name}_${i}`),
        adviserId: s.adviserId,
        sectionId: s.id,
        gradeLevel: s.gradeLevel as any,
        reason: "Need SF10 read to cross-check final entries against learner documents.",
        status: st,
        decidedBy: st === "pending" ? null : registrarId,
        decidedAt: st === "pending" ? null : new Date(),
        decisionReason: st === "denied" ? "Anecdotal attachments are not part of SF10." : null,
      };
    });
    await bulkCreate("Sf10Access", rows.length, (ch) => prisma.adviserSf10AccessRequest.createMany({ data: ch, skipDuplicates: true }) as any, rows, 500);
  }

  // ---- Archived (transferred/inactive simulation, ~50) ----
  {
    const sampledRoster = rng.shuffle(roster.rosterAll).slice(0, 30);
    const sampledProfiles = rng.shuffle(roster.profiles).slice(0, 20);
    const rows: any[] = [];
    for (const r of sampledRoster) {
      const sec = acad.sectionById.get(r.sectionId);
      if (!sec) continue;
      rows.push({ teacherId: sec.adviserId, rosterId: r.id });
    }
    for (const p of sampledProfiles) {
      const sec = acad.sectionById.get(p.sectionId);
      if (!sec) continue;
      rows.push({ teacherId: sec.adviserId, studentId: p.userId });
    }
    await bulkCreate("Archived", rows.length, (ch) => prisma.adviserArchivedStudent.createMany({ data: ch, skipDuplicates: true }) as any, rows, 500);
  }

  // ---- Grade flags (~120, studentId only) ----
  {
    const reasons = ["wrong_score", "missing_assessment", "transmutation_error", "late_submission", "other"] as const;
    const rows: any[] = [];
    const profSample = rng.shuffle(roster.profiles).slice(0, 120);
    const subjByGrade = new Map<string, { id: string }[]>();
    for (const s of acad.subjects) {
      const a = subjByGrade.get(s.gradeLevel) ?? [];
      a.push(s);
      subjByGrade.set(s.gradeLevel, a);
    }
    for (let i = 0; i < profSample.length; i++) {
      const p = profSample[i];
      const pool = subjByGrade.get(p.gradeLevel) ?? acad.subjects;
      const subj = rng.pick(pool);
      const sec = acad.sectionById.get(p.sectionId);
      if (!sec) continue;
      const ownerAssign = acad.assignments.find((a) => a.subjectId === subj.id && a.sectionId === sec.id && a.termId === core.t1Id);
      const termId = rng.next() < 0.7 ? core.t1Id : core.t2Id;
      const st = rng.weighted(["open", "open", "resolved", "escalated"], [0.4, 0.2, 0.3, 0.1]);
      rows.push({
        id: keyId("gf", `${p.userId.slice(-6)}_${subj.code}_${i}`),
        studentId: p.userId,
        subjectId: subj.id,
        sectionId: sec.id,
        termId,
        reason: rng.pick([...reasons]) as any,
        note: "Transmuted grade does not match class record; request review.",
        status: st as any,
        raisedBy: rng.pick(acad.allTeachers).id,
        ownerId: ownerAssign?.teacherId ?? sec.adviserId,
        resolvedBy: st === "resolved" ? (ownerAssign?.teacherId ?? sec.adviserId) : null,
        resolvedAt: st === "resolved" ? new Date() : null,
        resolutionNote: st === "resolved" ? "Corrected and re-locked." : null,
        escalatedAt: st === "escalated" ? new Date(Date.now() - 10 * 86_400_000) : null,
      });
    }
    await bulkCreate("GradeFlags", rows.length, (ch) => prisma.gradeFlag.createMany({ data: ch, skipDuplicates: true }) as any, rows, 500);
  }
}
