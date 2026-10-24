// Pure subject-map builder: school catalog vs OCR-extracted SF10 subjects.
// No Prisma here so it stays unit-testable without a database.

import { normalizeSubjectName } from "./subject-aliases.js";

export interface SchoolSubjectRef {
  id?: string;
  code: string;
  name: string;
}

export interface CatalogSubjectRef extends SchoolSubjectRef {
  gradeLevel: string;
  category?: string;
}

export interface OcrSubjectRef {
  rawName: string;
  norm?: string | null;
  grade?: number | null;
  /** Final rating. Null/0 = NOT TAKEN (policy); any other score = taken. */
  rating?: number | null;
  /** Grade the row belongs to. Null = untagged → current grade only. */
  gradeLevel?: string | null;
  /** Quarterly ratings Q1–Q4 in column order, if read. */
  quarters?: Array<number | null> | null;
  /** SHS only: per-semester finals [1st sem, 2nd sem], if read. */
  semFinals?: Array<number | null> | null;
  /** PASSED / FAILED … as printed, if read. */
  remarks?: string | null;
}

export interface SubjectMapEntry {
  code: string;
  name: string;
  norm: string;
  /** Subject name exactly as written on the file. Kept so desks can show the
   * record's own wording when the catalog absorbed a differently named row. */
  rawName?: string | null;
  rating?: number | null;
  quarters?: Array<number | null> | null;
  /** SHS only: per-semester finals [1st sem, 2nd sem], if read. */
  semFinals?: Array<number | null> | null;
  remarks?: string | null;
  /** Position of the file row (per-grade tables list subjects as on record). */
  order?: number;
}

export interface Sf10OnlyEntry {
  rawName: string;
  norm: string;
  gradeLevel: string | null;
  rating: number | null;
  quarters: Array<number | null> | null;
  remarks: string | null;
}

export interface SubjectMapResult {
  matched: SubjectMapEntry[];
  sf10Only: Sf10OnlyEntry[];
  missing: SubjectMapEntry[];
  needsReview: boolean;
}

export interface DeficiencyEntry extends SubjectMapEntry {
  gradeLevel: string;
  category: string;
  reason: "not-taken";
}

export interface PerGradeExtra {
  rawName: string;
  norm: string;
  rating: number | null;
  quarters: Array<number | null> | null;
  /** SHS only: per-semester finals [1st sem, 2nd sem], if read. */
  semFinals?: Array<number | null> | null;
  remarks: string | null;
  /** Position of the file row (per-grade tables list subjects as on record). */
  order: number;
}

export interface PerGradeMap {
  gradeLevel: string;
  matched: SubjectMapEntry[];
  missing: (SubjectMapEntry & { category: string })[];
  /** File rows for this grade that match no catalog subject (previous school). */
  extras: PerGradeExtra[];
  total: number;
}

export interface DeficiencyMapResult {
  perGrade: PerGradeMap[];
  deficiencies: DeficiencyEntry[];
  /** File rows with no grade indicated: add-ons, kept on record as-is. */
  addons: PerGradeExtra[];
  coverage: { gradesDetected: string[] };
}

const GRADE_ORDER = ["G7", "G8", "G9", "G10", "G11", "G12"] as const;

/** Taken = row exists with a real rating (not null, not 0). Any score counts. */
export function isTaken(rating: number | null | undefined): boolean {
  return typeof rating === "number" && Number.isFinite(rating) && rating !== 0;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let carry = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, carry + cost);
      carry = next;
    }
  }
  return prev[b.length];
}

function normsMatch(schoolNorm: string, ocrNorm: string): boolean {
  if (!schoolNorm || !ocrNorm) return false;
  if (schoolNorm === ocrNorm) return true;
  // "MAPEH" vs "music / arts / pe / health" style partials.
  if (schoolNorm.length > 4 && ocrNorm.length > 4) {
    if (schoolNorm.includes(ocrNorm) || ocrNorm.includes(schoolNorm)) return true;
  }
  // Typo tolerance for OCR misreads (e.g. "mathematlcs").
  if (Math.abs(schoolNorm.length - ocrNorm.length) <= 2) {
    const distance = levenshtein(schoolNorm, ocrNorm);
    const longest = Math.max(schoolNorm.length, ocrNorm.length);
    if (longest >= 6 && distance <= 2) return true;
    if (longest >= 4 && distance <= 1) return true;
  }
  return false;
}

export function buildSubjectMap(
  schoolSubjects: SchoolSubjectRef[],
  ocrSubjects: OcrSubjectRef[],
): SubjectMapResult {
  const school = schoolSubjects.map((s) => ({
    code: s.code,
    name: s.name,
    norm: normalizeSubjectName(`${s.name} ${s.code}`.trim() || s.name),
  }));
  // Fall back to name-only norm when code pollutes the key (e.g. code "MATH7").
  const schoolNorms = school.map((s) => {
    const nameOnly = normalizeSubjectName(s.name);
    return nameOnly || s.norm;
  });

  const ocr = ocrSubjects.map((o) => ({
    rawName: o.rawName,
    norm: (o.norm ?? "").trim() || normalizeSubjectName(o.rawName),
    rating: typeof o.rating === "number" ? o.rating : (typeof o.grade === "number" ? o.grade : null),
    gradeLevel: o.gradeLevel ?? null,
    quarters: o.quarters ?? null,
    remarks: o.remarks ?? null,
  }));

  const matched: SubjectMapEntry[] = [];
  const usedOcr = new Set<number>();
  const usedSchool = new Set<number>();

  school.forEach((s, si) => {
    const sNorm = schoolNorms[si];
    for (let oi = 0; oi < ocr.length; oi++) {
      if (usedOcr.has(oi)) continue;
      if (normsMatch(sNorm, ocr[oi].norm)) {
        matched.push({ ...s, rating: ocr[oi].rating, quarters: ocr[oi].quarters, remarks: ocr[oi].remarks });
        usedSchool.add(si);
        usedOcr.add(oi);
        break;
      }
    }
  });

  const sf10Only: Sf10OnlyEntry[] = [];
  const seenOnly = new Set<string>();
  for (const [i, o] of ocr.entries()) {
    if (usedOcr.has(i)) continue;
    if (seenOnly.has(o.norm)) continue;
    seenOnly.add(o.norm);
    sf10Only.push({
      rawName: o.rawName,
      norm: o.norm,
      gradeLevel: o.gradeLevel,
      rating: o.rating,
      quarters: o.quarters,
      remarks: o.remarks,
    });
  }
  const missing: SubjectMapEntry[] = school.filter((_, si) => !usedSchool.has(si));

  return {
    matched,
    sf10Only,
    missing,
    needsReview: sf10Only.length > 0,
  };
}

/**
 * Per-year deficiency map (strict per-grade, no cross-grade credit).
 * Only rows tagged with a grade count for that grade. Rows with no grade
 * indicated are add-ons: reported separately, never counted as taken.
 * A match counts as taken only when rating is a real score (not null, not 0).
 */
export function buildDeficiencyMap(
  catalog: CatalogSubjectRef[],
  ocrSubjects: OcrSubjectRef[],
  currentGrade: string,
): DeficiencyMapResult {
  const ocr = ocrSubjects.map((o) => ({
    rawName: o.rawName,
    norm: (o.norm ?? "").trim() || normalizeSubjectName(o.rawName),
    rating: typeof o.rating === "number" ? o.rating : (typeof o.grade === "number" ? o.grade : null),
    gradeLevel: o.gradeLevel ?? null,
    quarters: o.quarters ?? null,
    semFinals: o.semFinals ?? null,
    remarks: o.remarks ?? null,
  }));
  const gradesDetected = [...new Set(ocr.map((o) => o.gradeLevel).filter((g): g is string => !!g))];

  // Add-ons: file rows with no grade indicated — own record, own table.
  // Nameless rows carry no information and are skipped so the section
  // never renders an empty list. Rows with no grades at all are blank
  // template text (e.g. an empty duplicate sheet), not add-on subjects.
  const addons: PerGradeExtra[] = [];
  const seenAddon = new Set<string>();
  for (const [oi, o] of ocr.entries()) {
    // One row per full name as written ("ICF 7" vs "ICF 9" stay separate).
    const addonKey = `${o.norm}|${(o.rawName || "").toUpperCase().trim()}`;
    if (o.gradeLevel != null || seenAddon.has(addonKey)) continue;
    if (!o.rawName.trim()) continue;
    const hasGrades =
      (typeof o.rating === "number" && Number.isFinite(o.rating)) ||
      (o.quarters ?? []).some((q) => typeof q === "number" && Number.isFinite(q));
    if (!hasGrades) continue;
    seenAddon.add(addonKey);
    addons.push({
      rawName: o.rawName,
      norm: o.norm,
      rating: o.rating,
      quarters: o.quarters,
      remarks: o.remarks,
      order: oi,
    });
  }

  const currentIdx = GRADE_ORDER.indexOf(currentGrade as (typeof GRADE_ORDER)[number]);
  // SHS records (no JHS-grade subjects on file) only span G11–G12: do not
  // surface G7–G10 as all-missing for an SHS learner.
  const currentIsShsGrade = currentIdx >= GRADE_ORDER.indexOf("G11");
  const hasJhsGrades = ocr.some(
    (o) => typeof o.gradeLevel === "string" && GRADE_ORDER.indexOf(o.gradeLevel as (typeof GRADE_ORDER)[number]) < GRADE_ORDER.indexOf("G11"),
  );
  const isShs = currentIsShsGrade && !hasJhsGrades;
  const startIdx = isShs ? GRADE_ORDER.indexOf("G11") : 0;
  const grades = (currentIdx >= 0 ? GRADE_ORDER.slice(startIdx, currentIdx + 1) : [currentGrade]) as string[];

  const perGrade: PerGradeMap[] = [];
  const deficiencies: DeficiencyEntry[] = [];

  for (const grade of grades) {
    const catalogForGrade = catalog.filter((c) => c.gradeLevel === grade);
    // Strict: only rows tagged for this grade. Untagged rows are add-ons.
    // The catalog is only the basis for not-taken (missing/deficiencies):
    // grade tables always show the file's own rows, even when no school
    // subjects are set for that grade (all rows land in extras).
    const eligible = ocr.filter((o) => o.gradeLevel === grade);
    if (catalogForGrade.length === 0 && eligible.length === 0) continue;
    const school = catalogForGrade.map((s) => ({
      code: s.code,
      name: s.name,
      norm: normalizeSubjectName(s.name) || normalizeSubjectName(`${s.name} ${s.code}`),
      category: s.category ?? "CORE",
    }));
    const matched: SubjectMapEntry[] = [];
    const used = new Set<number>();
    const missing: (SubjectMapEntry & { category: string })[] = [];
    school.forEach((s) => {
      let takenIdx = -1;
      for (let i = 0; i < eligible.length; i++) {
        if (used.has(i)) continue;
        if (normsMatch(s.norm, eligible[i].norm) && isTaken(eligible[i].rating)) {
          takenIdx = i;
          used.add(i);
          break;
        }
      }
      if (takenIdx >= 0) {
        const src = eligible[takenIdx];
        matched.push({
          code: s.code,
          name: s.name,
          norm: s.norm,
          rawName: src.rawName,
          rating: src.rating,
          quarters: src.quarters,
          semFinals: src.semFinals,
          remarks: src.remarks,
          order: ocr.indexOf(src),
        });
      } else {
        missing.push({ code: s.code, name: s.name, norm: s.norm, category: s.category });
        deficiencies.push({
          code: s.code,
          name: s.name,
          norm: s.norm,
          gradeLevel: grade,
          category: s.category,
          reason: "not-taken",
        });
      }
    });
    // File rows for this grade that match nothing in the catalog: shown
    // exactly as on the record, interleaved with matched rows by file order.
    const extras: PerGradeExtra[] = [];
    const seenExtra = new Set<string>();
    eligible.forEach((o, i) => {
      const extraKey = `${o.norm}|${(o.rawName || "").toUpperCase().trim()}`;
      if (used.has(i) || seenExtra.has(extraKey)) return;
      if (!o.rawName.trim()) return;
      seenExtra.add(extraKey);
      extras.push({
        rawName: o.rawName,
        norm: o.norm,
        rating: o.rating,
        quarters: o.quarters,
        semFinals: o.semFinals,
        remarks: o.remarks,
        order: ocr.indexOf(o),
      });
    });
    matched.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    extras.sort((a, b) => a.order - b.order);
    perGrade.push({ gradeLevel: grade, matched, missing, extras, total: school.length });
  }

  return { perGrade, deficiencies, addons, coverage: { gradesDetected } };
}
