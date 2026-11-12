import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { GRADE_BAND_7_10 } from "../../lib/roles.js";
import { fanoutToRole } from "../../lib/notify.js";
import {
  archivedAdvisoryLearnerIds,
  excludeArchivedProfiles,
  excludeArchivedRosters,
} from "../../lib/learnerVisibility.js";
import type { GradeLevel } from "../../generated/prisma/client.js";
import { normalizeSubjectName } from "../sf10/subject-aliases.js";
import {
  applyAutoFilledSubjects,
  type OcrSubjectPayload,
} from "../sf10/records.service.js";
import type { Sf10Context } from "../sf10/sf10.types.js";

export interface GradeFact {
  subjectId: string;
  subjectName: string;
  termNumber: number;
  rating: number;
}

export interface AutofillSkip {
  subject: string;
  terms: number;
  reason: string;
}

export interface AutofillRow {
  subject: string;
  norm: string;
  rating: number;
  quarters: Array<number | null>;
  remarks: "PASSED" | "FAILED";
}

export interface AutofillRowBuild {
  rows: AutofillRow[];
  skipped: AutofillSkip[];
}

function ratingsOf(facts: GradeFact[]): GradeFact[] {
  return facts.filter((f) => Number.isFinite(f.rating));
}

/**
 * Pure helper: one SF10 row per subject, only when every required term has an
 * adviser-approved rating. Q1–Q3 come from terms 1–3, Q4 stays blank (Zentra
 * runs trimesters); the subject rating is the rounded mean.
 */
export function buildAutofillRows(
  facts: GradeFact[],
  gradeLevel: string,
  requiredTermNumbers: number[],
): AutofillRowBuild {
  const clean = ratingsOf(facts);
  const bySubject = new Map<string, { name: string; byTerm: Map<number, number> }>();
  for (const f of clean) {
    const entry = bySubject.get(f.subjectId) ?? { name: f.subjectName, byTerm: new Map() };
    entry.byTerm.set(f.termNumber, f.rating);
    bySubject.set(f.subjectId, entry);
  }

  const rows: AutofillRow[] = [];
  const skipped: AutofillSkip[] = [];
  for (const [, entry] of bySubject) {
    const missing = requiredTermNumbers.filter((t) => !entry.byTerm.has(t));
    if (missing.length > 0) {
      skipped.push({
        subject: entry.name,
        terms: requiredTermNumbers.length - missing.length,
        reason: `${requiredTermNumbers.length - missing.length}/${requiredTermNumbers.length} terms approved`,
      });
      continue;
    }
    const quarters: Array<number | null> = requiredTermNumbers
      .slice(0, 4)
      .map((t) => Math.round(entry.byTerm.get(t) as number));
    // SF10 always has four quarter columns; Zentra runs trimesters, so Q4 stays blank.
    while (quarters.length < 4) quarters.push(null);
    const total = quarters.reduce<number>((sum, v) => sum + (v ?? 0), 0);
    const rating = Math.round(total / requiredTermNumbers.length);
    rows.push({
      subject: entry.name,
      norm: normalizeSubjectName(entry.name),
      rating,
      quarters,
      remarks: rating >= 75 ? "PASSED" : "FAILED",
    });
  }
  rows.sort((a, b) => a.subject.localeCompare(b.subject));
  skipped.sort((a, b) => a.subject.localeCompare(b.subject));
  return { rows, skipped };
}

interface SectionLearner {
  lrn: string;
  name: string;
  mascot: string | null;
  gradeLevel: GradeLevel;
  profileId: string | null;
  /** Grade + section on the learner's SF10 owner profile (null when no account). */
  profileGradeLevel: GradeLevel | null;
  rosterIds: string[];
}

interface Sf10RecordLite {
  id: string;
  desk: string;
  status: string;
  currentVersion: number;
  studentId: string;
}

interface SectionContext {
  section: { id: string; name: string; gradeLevel: GradeLevel; schoolYearId: string };
  schoolYear: { id: string; name: string };
  requiredTermNumbers: number[];
  learners: SectionLearner[];
  recordsByStudent: Map<string, Sf10RecordLite[]>;
  grants: Array<{ sectionId: string; status: string; approvedLrns: string[] }>;
  factsByLrn: Map<string, GradeFact[]>;
}

export interface AutofillCandidate {
  lrn: string;
  name: string;
  mascot: string | null;
  gradeLevel: string;
  section: string;
  recordId: string | null;
  recordStatus: string | null;
  currentVersion: number | null;
  subjectsReady: number;
  subjectsSkipped: number;
  ready: boolean;
  reason: string | null;
}

export interface AutofillPreviewStudent extends AutofillCandidate {
  rows: AutofillRow[];
  skipped: AutofillSkip[];
}

export interface AutofillPreview {
  sectionId: string;
  section: string;
  gradeLevel: string;
  schoolYear: { id: string; name: string };
  students: AutofillPreviewStudent[];
}

export interface AutofillResultRow {
  lrn: string;
  name: string;
  status: "updated" | "skipped" | "failed";
  recordId: string | null;
  version: number | null;
  added: number;
  replaced: number;
  message: string;
}

export interface AutofillResult {
  sectionId: string;
  section: string;
  updated: number;
  skipped: number;
  failed: number;
  results: AutofillResultRow[];
}

/**
 * Access is LRN-scoped: a per-student approval grants that learner even when
 * their profile has no section, and a whole-request approval covers every
 * advisee on the advisory section's roster. The SF10 record links to the
 * learner by LRN only — the profile's stored section/grade is never the gate.
 */
function hasGrant(
  grants: Array<{ sectionId: string; status: string; approvedLrns: string[] }>,
  lrn: string,
  sectionId: string,
): boolean {
  return grants.some(
    (g) => g.approvedLrns.includes(lrn) || (g.status === "approved" && g.sectionId === sectionId),
  );
}

/**
 * Desk that owns the learner's SF10 record. The current grade comes from the
 * advisory section (the enrollment being filled), not the profile field — a
 * profile can lag behind the roster and would otherwise pick the wrong desk.
 */
function recordFor(
  records: Sf10RecordLite[],
  currentGrade: string,
): Sf10RecordLite | null {
  const desk = (GRADE_BAND_7_10 as string[]).includes(currentGrade) ? "record_keeper" : "registrar";
  return records.find((r) => r.desk === desk) ?? records[0] ?? null;
}

async function loadContext(
  userId: string,
  sectionId: string,
  onlyLrns?: Set<string>,
): Promise<SectionContext> {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: {
      id: true,
      name: true,
      gradeLevel: true,
      adviserId: true,
      schoolYearId: true,
      schoolYear: { select: { id: true, name: true } },
    },
  });
  if (!section) throw new AppError(404, "NOT_FOUND", "Section not found");
  if (section.adviserId !== userId) {
    throw new AppError(403, "FORBIDDEN", "You can only auto-fill your own advisory section");
  }

  const archivedLearners = await archivedAdvisoryLearnerIds();
  const [profiles, roster, terms, grants] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { sectionId, ...excludeArchivedProfiles(archivedLearners) },
      select: {
        userId: true,
        lrn: true,
        mascot: true,
        gradeLevel: true,
        user: { select: { fullName: true } },
      },
      orderBy: { lrn: "asc" },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId, ...excludeArchivedRosters(archivedLearners) },
      select: { id: true, lrn: true, fullName: true, mascot: true, gradeLevel: true },
      orderBy: { lrn: "asc" },
    }),
    prisma.term.findMany({
      where: { schoolYearId: section.schoolYearId },
      orderBy: { termNumber: "asc" },
      select: { termNumber: true },
    }),
    // Every grant the adviser holds: per-LRN approvals can come from a request
    // filed for another section, and whole-request approvals are section-scoped.
    prisma.adviserSf10AccessRequest.findMany({
      where: { adviserId: userId },
      select: { sectionId: true, status: true, approvedLrns: true },
    }),
  ]);

  const requiredTermNumbers = terms
    .map((t) => t.termNumber)
    .filter((n) => n >= 1 && n <= 4)
    .slice(0, 4);
  if (requiredTermNumbers.length === 0) {
    throw new AppError(409, "NO_TERMS", "This school year has no terms to fill from.");
  }

  const learnersByLrn = new Map<string, SectionLearner>();
  for (const p of profiles) {
    learnersByLrn.set(p.lrn, {
      lrn: p.lrn,
      name: p.user.fullName,
      mascot: p.mascot ?? null,
      gradeLevel: p.gradeLevel,
      profileId: p.userId,
      profileGradeLevel: p.gradeLevel,
      rosterIds: [],
    });
  }
  for (const r of roster) {
    const existing = learnersByLrn.get(r.lrn);
    if (existing) {
      existing.rosterIds.push(r.id);
      continue;
    }
    learnersByLrn.set(r.lrn, {
      lrn: r.lrn,
      name: r.fullName,
      mascot: r.mascot ?? null,
      gradeLevel: r.gradeLevel,
      profileId: null,
      profileGradeLevel: null,
      rosterIds: [r.id],
    });
  }

  // Roster rows are the section enlistment; the learner's account may not point
  // back at this section (moved, or enrolled by LRN only). Resolve it by LRN so
  // the flow never depends on the account's section being in sync.
  const unresolvedLrns = [...learnersByLrn.values()]
    .filter((l) => !l.profileId && (!onlyLrns || onlyLrns.size === 0 || onlyLrns.has(l.lrn)))
    .map((l) => l.lrn);
  if (unresolvedLrns.length > 0) {
    const byLrn = await prisma.studentProfile.findMany({
      where: { lrn: { in: unresolvedLrns } },
      select: {
        userId: true,
        lrn: true,
        mascot: true,
        gradeLevel: true,
        user: { select: { fullName: true } },
      },
    });
    for (const p of byLrn) {
      const learner = learnersByLrn.get(p.lrn);
      if (!learner) continue;
      learner.profileId = p.userId;
      learner.profileGradeLevel = p.gradeLevel;
      learner.name = p.user.fullName;
      learner.mascot = p.mascot ?? learner.mascot;
    }
  }

  let learners = [...learnersByLrn.values()];
  if (onlyLrns && onlyLrns.size > 0) learners = learners.filter((l) => onlyLrns.has(l.lrn));

  const profileIds = learners.map((l) => l.profileId).filter((id): id is string => id != null);
  const rosterIds = learners.flatMap((l) => l.rosterIds);

  const [records, finals] = await Promise.all([
    profileIds.length > 0
      ? prisma.sf10Record.findMany({
          where: { studentId: { in: profileIds } },
          select: {
            id: true,
            desk: true,
            status: true,
            currentVersion: true,
            studentId: true,
          },
        })
      : Promise.resolve([] as Sf10RecordLite[]),
    prisma.finalGrade.findMany({
      where: {
        lockStatus: "adviser_approved",
        term: { schoolYearId: section.schoolYearId },
        OR: [
          ...(profileIds.length > 0 ? [{ studentId: { in: profileIds } }] : []),
          ...(rosterIds.length > 0 ? [{ rosterId: { in: rosterIds } }] : []),
        ],
      },
      select: {
        studentId: true,
        rosterId: true,
        subjectId: true,
        transmutedGrade: true,
        computedAverage: true,
        term: { select: { termNumber: true } },
        subject: { select: { name: true } },
      },
    }),
  ]);

  const recordsByStudent = new Map<string, Sf10RecordLite[]>();
  for (const r of records) {
    const list = recordsByStudent.get(r.studentId) ?? [];
    list.push(r);
    recordsByStudent.set(r.studentId, list);
  }

  const lrnByProfile = new Map(learners.filter((l) => l.profileId).map((l) => [l.profileId as string, l.lrn]));
  const lrnByRoster = new Map<string, string>();
  for (const l of learners) for (const id of l.rosterIds) lrnByRoster.set(id, l.lrn);

  const factsByLrn = new Map<string, GradeFact[]>();
  for (const f of finals) {
    const rating = f.transmutedGrade ?? f.computedAverage;
    if (rating == null || !Number.isFinite(rating)) continue;
    const lrn = (f.studentId ? lrnByProfile.get(f.studentId) : undefined) ?? (f.rosterId ? lrnByRoster.get(f.rosterId) : undefined);
    if (!lrn) continue;
    const list = factsByLrn.get(lrn) ?? [];
    list.push({
      subjectId: f.subjectId,
      subjectName: f.subject.name,
      termNumber: f.term.termNumber,
      rating,
    });
    factsByLrn.set(lrn, list);
  }

  return {
    section: {
      id: section.id,
      name: section.name,
      gradeLevel: section.gradeLevel,
      schoolYearId: section.schoolYearId,
    },
    schoolYear: section.schoolYear,
    requiredTermNumbers,
    learners,
    recordsByStudent,
    grants,
    factsByLrn,
  };
}

function buildStudent(
  learner: SectionLearner,
  ctx: SectionContext,
): AutofillPreviewStudent {
  // The section is the current enrollment: it decides which grade block the
  // adviser-approved finals are filed under. `profile.gradeLevel` can be stale
  // (e.g. registered as G8 but sitting in a G7 section), so never use it here.
  const grade: GradeLevel = ctx.section.gradeLevel;
  const record = learner.profileId
    ? recordFor(ctx.recordsByStudent.get(learner.profileId) ?? [], grade)
    : null;
  // A learner with no account cannot own an SF10 record (records key on the
  // profile), so there is simply nothing to fill — never an error.
  // Access is granted per learner by LRN: a per-student approval follows the
  // LRN wherever the SF10 record is filed, and a whole-request approval covers
  // the advisory section. The profile's section/grade never gates the fill.
  const grant = hasGrant(ctx.grants, learner.lrn, ctx.section.id);
  const { rows, skipped } = buildAutofillRows(
    ctx.factsByLrn.get(learner.lrn) ?? [],
    grade,
    ctx.requiredTermNumbers,
  );

  let reason: string | null = null;
  if (!learner.profileId) reason = "No SF10 record yet (no learner profile)";
  else if (!record) reason = "No SF10 record yet";
  else if (record.status === "released") reason = "SF10 already released";
  else if (!grant) reason = "SF10 access not approved";
  else if (rows.length === 0) {
    reason =
      skipped.length > 0
        ? `No subject has all ${ctx.requiredTermNumbers.length} terms approved yet`
        : "No adviser-approved grades yet";
  }

  return {
    lrn: learner.lrn,
    name: learner.name,
    mascot: learner.mascot,
    gradeLevel: grade,
    section: ctx.section.name,
    recordId: record?.id ?? null,
    recordStatus: record?.status ?? null,
    currentVersion: record?.currentVersion ?? null,
    subjectsReady: rows.length,
    subjectsSkipped: skipped.length,
    ready: reason === null && rows.length > 0,
    reason,
    rows,
    skipped,
  };
}

export async function listCandidates(userId: string, sectionId: string): Promise<{ candidates: AutofillCandidate[] }> {
  const ctx = await loadContext(userId, sectionId);
  const candidates = ctx.learners
    .map((l) => buildStudent(l, ctx))
    .map(({ rows: _rows, skipped: _skipped, ...rest }) => rest);
  return { candidates };
}

export async function getPreview(
  userId: string,
  sectionId: string,
  studentLrns: string[],
): Promise<AutofillPreview> {
  const picked = new Set(studentLrns.map((l) => l.trim()).filter(Boolean));
  if (picked.size === 0) throw new AppError(400, "BAD_REQUEST", "Pick at least one student");
  if (picked.size > 200) throw new AppError(400, "BAD_REQUEST", "Select at most 200 students");

  const ctx = await loadContext(userId, sectionId, picked);
  if (ctx.learners.length !== picked.size) {
    throw new AppError(400, "BAD_REQUEST", "Selected students must belong to your advisory section");
  }
  return {
    sectionId: ctx.section.id,
    section: ctx.section.name,
    gradeLevel: ctx.section.gradeLevel,
    schoolYear: ctx.schoolYear,
    students: ctx.learners.map((l) => buildStudent(l, ctx)),
  };
}

export async function runAutofill(
  ctx: Sf10Context,
  sectionId: string,
  studentLrns: string[],
): Promise<AutofillResult> {
  const preview = await getPreview(ctx.userId, sectionId, studentLrns);
  const results: AutofillResultRow[] = [];

  for (const student of preview.students) {
    if (!student.ready || !student.recordId) {
      results.push({
        lrn: student.lrn,
        name: student.name,
        status: "skipped",
        recordId: student.recordId,
        version: null,
        added: 0,
        replaced: 0,
        message: student.reason ?? "Nothing to fill",
      });
      continue;
    }
    try {
      const payload: OcrSubjectPayload[] = student.rows.map((r) => ({
        rawName: r.subject,
        norm: r.norm,
        grade: r.rating,
        rating: r.rating,
        gradeLevel: student.gradeLevel,
        quarters: r.quarters,
        remarks: r.remarks,
      }));
      const write = await applyAutoFilledSubjects(ctx, student.recordId, student.gradeLevel, payload);
      if (write.wasVerified) {
        const deskRole = (GRADE_BAND_7_10 as string[]).includes(student.gradeLevel)
          ? "record_keeper"
          : "registrar";
        await fanoutToRole(deskRole, {
          sourceTable: "sf10_records",
          action: "autofill",
          message: `SF10 auto-filled for ${student.name} (${preview.section}) — re-verification needed.`,
          sourceId: student.recordId,
          excludeUserId: ctx.userId,
        });
      }
      results.push({
        lrn: student.lrn,
        name: student.name,
        status: "updated",
        recordId: student.recordId,
        version: write.version,
        added: write.added,
        replaced: write.replaced,
        message: `${student.rows.length} subject${student.rows.length === 1 ? "" : "s"} filled`,
      });
    } catch (e) {
      const message = e instanceof AppError ? e.message : "Could not fill this record";
      results.push({
        lrn: student.lrn,
        name: student.name,
        status: "failed",
        recordId: student.recordId,
        version: null,
        added: 0,
        replaced: 0,
        message,
      });
    }
  }

  return {
    sectionId: preview.sectionId,
    section: preview.section,
    updated: results.filter((r) => r.status === "updated").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
  };
}
