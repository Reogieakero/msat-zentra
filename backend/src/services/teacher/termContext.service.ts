import { createHash } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { invalidateTags } from "../../lib/cache.js";
import { CACHE_TAGS } from "../../lib/cacheTags.js";
import { GRADE_LABELS } from "../../modules/teacher/teacher.repository.js";
import type { TeacherContext } from "./teacher.types.js";

export type TermConfirmationKind = "roster" | "classes";

export interface TermContextTerm {
  id: string;
  termNumber: number;
  schoolYearId: string;
  schoolYearName: string;
  startDate: string | null;
  endDate: string | null;
}

export interface TermContextLearner {
  id: string;
  lrn: string;
  name: string;
  sectionId: string;
  section: string;
  gradeLevel: string;
  enlistedTermId: string | null;
}

export interface TermContextClassRef {
  id: string; // subjectId|sectionId
  subject: string;
  section: string;
}

export interface TermContextView {
  term: TermContextTerm | null;
  previousTerm: TermContextTerm | null;
  isAdviser: boolean;
  advisorySections: { id: string; name: string; gradeLevel: string }[];
  roster: {
    total: number;
    fingerprint: string;
    learners: TermContextLearner[];
  };
  /** Learners enlisted in the selected term (only meaningful same-year). */
  newLearners: TermContextLearner[];
  /** Roster diff against the previous term/school year, by LRN. */
  diff: {
    added: TermContextLearner[];
    removed: { lrn: string; name: string; section: string }[];
  };
  classes: {
    current: TermContextClassRef[];
    /** Previous term's classes — the default view when "same" is chosen. */
    previous: TermContextClassRef[];
    added: TermContextClassRef[];
    removed: TermContextClassRef[];
  };
  /** "none" = no previous roster to compare (new school year). */
  baseline: "previous-term" | "none";
  /** True when the previous term sits in the same school year. */
  sameSchoolYear: boolean;
  /** Stored answer to "same students and classes as last term?". */
  sameAsPrevious: boolean | null;
  acknowledgedAt: string | null;
  changedSinceAck: boolean;
  /** Prompt the adviser once per term, and again if the roster changes after. */
  needsConfirmation: boolean;
  reason: "first-visit" | "roster-changed" | null;
}

function fingerprintOf(rows: { lrn: string; sectionId: string }[]): string {
  const canonical = rows
    .map((r) => `${r.lrn}|${r.sectionId}`)
    .sort()
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex");
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function termView(
  row: {
    id: string;
    termNumber: number;
    schoolYearId: string;
    startDate: Date | null;
    endDate: Date | null;
    schoolYear: { name: string };
  } | null,
): TermContextTerm | null {
  if (!row) return null;
  return {
    id: row.id,
    termNumber: row.termNumber,
    schoolYearId: row.schoolYearId,
    schoolYearName: row.schoolYear.name,
    startDate: iso(row.startDate),
    endDate: iso(row.endDate),
  };
}

async function resolvePreviousTerm(term: {
  id: string;
  termNumber: number;
  schoolYearId: string;
}) {
  if (term.termNumber > 1) {
    return prisma.term.findUnique({
      where: {
        schoolYearId_termNumber: {
          schoolYearId: term.schoolYearId,
          termNumber: term.termNumber - 1,
        },
      },
      select: {
        id: true,
        termNumber: true,
        schoolYearId: true,
        startDate: true,
        endDate: true,
        schoolYear: { select: { name: true } },
      },
    });
  }
  // Term 1: fall back to the latest term of the previous school year.
  const previousYear = await prisma.schoolYear.findFirst({
    where: { startDate: { lt: new Date() }, id: { not: term.schoolYearId } },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });
  if (!previousYear) return null;
  return prisma.term.findFirst({
    where: { schoolYearId: previousYear.id },
    orderBy: { termNumber: "desc" },
    select: {
      id: true,
      termNumber: true,
      schoolYearId: true,
      startDate: true,
      endDate: true,
      schoolYear: { select: { name: true } },
    },
  });
}

type SectionRow = { id: string; name: string; gradeLevel: string };

async function rosterRows(sectionIds: string[]) {
  if (sectionIds.length === 0) return [];
  return prisma.studentRoster.findMany({
    where: { sectionId: { in: sectionIds } },
    select: {
      id: true,
      lrn: true,
      fullName: true,
      sectionId: true,
      gradeLevel: true,
      enlistedTermId: true,
      section: { select: { name: true } },
    },
    orderBy: { fullName: "asc" },
  });
}

type RosterRow = Awaited<ReturnType<typeof rosterRows>>[number];

function learnerOf(row: RosterRow): TermContextLearner {
  return {
    id: row.id,
    lrn: row.lrn,
    name: row.fullName,
    sectionId: row.sectionId,
    section: row.section.name,
    gradeLevel: GRADE_LABELS[row.gradeLevel] ?? row.gradeLevel,
    enlistedTermId: row.enlistedTermId,
  };
}

async function classRefs(termId: string, sectionIds: string[]): Promise<TermContextClassRef[]> {
  if (sectionIds.length === 0) return [];
  const [assignments, entries] = await Promise.all([
    prisma.teacherSubjectAssignment.findMany({
      where: { sectionId: { in: sectionIds }, termId },
      select: {
        subjectId: true,
        sectionId: true,
        subject: { select: { name: true } },
        section: { select: { name: true } },
      },
    }),
    prisma.sectionTimetableEntry.findMany({
      where: { sectionId: { in: sectionIds }, termId },
      select: {
        subjectId: true,
        sectionId: true,
        subject: { select: { name: true } },
        section: { select: { name: true } },
      },
    }),
  ]);
  const map = new Map<string, TermContextClassRef>();
  for (const row of [...assignments, ...entries]) {
    map.set(`${row.subjectId}|${row.sectionId}`, {
      id: `${row.subjectId}|${row.sectionId}`,
      subject: row.subject.name,
      section: row.section.name,
    });
  }
  return [...map.values()].sort(
    (a, b) => a.section.localeCompare(b.section) || a.subject.localeCompare(b.subject),
  );
}

function diffRefs(current: TermContextClassRef[], previous: TermContextClassRef[]) {
  const currentIds = new Set(current.map((c) => c.id));
  const previousIds = new Set(previous.map((c) => c.id));
  return {
    added: current.filter((c) => !previousIds.has(c.id)),
    removed: previous.filter((c) => !currentIds.has(c.id)),
  };
}

async function sectionsOf(teacherId: string, schoolYearId: string): Promise<SectionRow[]> {
  return prisma.section.findMany({
    where: { adviserId: teacherId, schoolYearId },
    select: { id: true, name: true, gradeLevel: true },
    orderBy: { name: "asc" },
  });
}

export async function getTermContext(ctx: TeacherContext): Promise<TermContextView> {
  const teacherId = ctx.userId;
  const empty: TermContextView = {
    term: null,
    previousTerm: null,
    isAdviser: false,
    advisorySections: [],
    roster: { total: 0, fingerprint: fingerprintOf([]), learners: [] },
    newLearners: [],
    diff: { added: [], removed: [] },
    classes: { current: [], previous: [], added: [], removed: [] },
    baseline: "none",
    sameSchoolYear: false,
    sameAsPrevious: null,
    acknowledgedAt: null,
    changedSinceAck: false,
    needsConfirmation: false,
    reason: null,
  };

  if (!ctx.termId) return empty;

  const term = await prisma.term.findUnique({
    where: { id: ctx.termId },
    select: {
      id: true,
      termNumber: true,
      schoolYearId: true,
      startDate: true,
      endDate: true,
      schoolYear: { select: { name: true } },
    },
  });
  if (!term) return empty;

  const advisorySections = await sectionsOf(teacherId, term.schoolYearId);
  const isAdviser = advisorySections.length > 0;
  const sectionIds = advisorySections.map((s) => s.id);
  const rows = await rosterRows(sectionIds);
  const learners = rows.map(learnerOf);
  const fingerprint = fingerprintOf(rows);

  const [previousTerm, currentClasses, acknowledged] = await Promise.all([
    resolvePreviousTerm(term),
    classRefs(term.id, sectionIds),
    prisma.termRosterConfirmation.findUnique({
      where: {
        userId_termId_kind: { userId: teacherId, termId: term.id, kind: "roster" },
      },
      select: {
        rosterFingerprint: true,
        sameAsPrevious: true,
        acknowledgedAt: true,
      },
    }),
  ]);

  // No adviser history before this term (e.g. brand-new school year) means
  // there is nothing to carry over — show the enlist prompt instead.
  if (!isAdviser || !previousTerm) {
    return {
      ...empty,
      term: termView(term),
      previousTerm: termView(previousTerm),
      isAdviser,
      advisorySections,
      roster: { total: learners.length, fingerprint, learners },
      classes: {
        current: currentClasses,
        previous: [],
        added: [],
        removed: [],
      },
      sameSchoolYear: previousTerm
        ? previousTerm.schoolYearId === term.schoolYearId
        : false,
      sameAsPrevious: acknowledged?.sameAsPrevious ?? null,
      acknowledgedAt: acknowledged ? iso(acknowledged.acknowledgedAt) : null,
    };
  }

  const previousSections = await sectionsOf(teacherId, previousTerm.schoolYearId);
  const previousSectionIds = previousSections.map((s) => s.id);
  const previousRows = await rosterRows(previousSectionIds);
  const previousClasses = await classRefs(previousTerm.id, previousSectionIds);
  const baseline = previousRows.length > 0 ? "previous-term" : "none";

  const currentLrns = new Set(rows.map((r) => r.lrn));
  const previousLrns = new Set(previousRows.map((r) => r.lrn));
  const added = rows.filter((r) => !previousLrns.has(r.lrn)).map(learnerOf);
  const removed = previousRows
    .filter((r) => !currentLrns.has(r.lrn))
    .map((r) => ({ lrn: r.lrn, name: r.fullName, section: r.section.name }));
  const newLearners = rows
    .filter((r) => r.enlistedTermId === term.id)
    .map(learnerOf);

  const classDiff = diffRefs(currentClasses, previousClasses);
  const changedSinceAck = !!acknowledged && acknowledged.rosterFingerprint !== fingerprint;
  // One prompt per term: once the adviser has answered, later roster changes
  // (e.g. a newly enlisted learner) never reopen it — the roster is edited on
  // the advisory list instead.
  const needsConfirmation = baseline === "previous-term" && !acknowledged;

  return {
    term: termView(term),
    previousTerm: termView(previousTerm),
    isAdviser,
    advisorySections,
    roster: { total: learners.length, fingerprint, learners },
    newLearners,
    diff: { added, removed },
    classes: { current: currentClasses, previous: previousClasses, ...classDiff },
    baseline,
    sameSchoolYear: previousTerm.schoolYearId === term.schoolYearId,
    sameAsPrevious: acknowledged?.sameAsPrevious ?? null,
    acknowledgedAt: acknowledged ? iso(acknowledged.acknowledgedAt) : null,
    changedSinceAck,
    needsConfirmation,
    reason: needsConfirmation ? "first-visit" : null,
  };
}

export async function acknowledgeTermContext(
  ctx: TeacherContext,
  input: {
    kind: TermConfirmationKind;
    fingerprint: string;
    sameAsPrevious?: boolean;
  },
) {
  const teacherId = ctx.userId;
  if (!ctx.termId) {
    throw new AppError(409, "NO_ACTIVE_TERM", "Pick a term first");
  }

  const term = await prisma.term.findUnique({
    where: { id: ctx.termId },
    select: { id: true, schoolYearId: true },
  });
  if (!term) {
    throw new AppError(404, "TERM_NOT_FOUND", "Term not found");
  }

  const advisorySections = await sectionsOf(teacherId, term.schoolYearId);
  if (advisorySections.length === 0) {
    throw new AppError(403, "NOT_ADVISER", "Only the section adviser can confirm the roster");
  }

  const rows = await rosterRows(advisorySections.map((s) => s.id));
  const current = fingerprintOf(rows);
  if (current !== input.fingerprint) {
    // The adviser acknowledged a roster that has since changed (a learner was
    // enlisted in another tab/device). Ask them to re-read the diff.
    throw new AppError(
      409,
      "ROSTER_CHANGED",
      "The roster changed after this page loaded. Review it again and confirm.",
    );
  }

  const saved = await prisma.termRosterConfirmation.upsert({
    where: {
      userId_termId_kind: { userId: teacherId, termId: term.id, kind: input.kind },
    },
    create: {
      userId: teacherId,
      termId: term.id,
      kind: input.kind,
      rosterFingerprint: current,
      sameAsPrevious: input.sameAsPrevious ?? true,
    },
    update: {
      rosterFingerprint: current,
      sameAsPrevious: input.sameAsPrevious ?? true,
      acknowledgedAt: new Date(),
    },
    select: { acknowledgedAt: true, sameAsPrevious: true },
  });

  await writeAudit({
    userId: teacherId,
    actionType: "update",
    sourceTable: "term_roster_confirmation",
    sourceId: `${teacherId}:${term.id}:${input.kind}`,
    reason: `Confirmed ${input.kind} for term ${term.id} (${rows.length} learners, ${
      saved.sameAsPrevious ? "same" : "new"
    } students/classes as previous term)`,
  });

  await invalidateTags([CACHE_TAGS.teacher, CACHE_TAGS.roster]);
  return {
    acknowledgedAt: saved.acknowledgedAt.toISOString(),
    sameAsPrevious: saved.sameAsPrevious,
  };
}
