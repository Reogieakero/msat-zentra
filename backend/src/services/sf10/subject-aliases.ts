// SF10 subject aliases — maps OCR text variants to a canonical normalized key.
// Both sides (OCR text and school Subject rows) go through normalizeSubjectName,
// so matching never depends on exact DepEd wording.

const ALIAS_TO_CANONICAL: Array<[canonical: string, aliases: string[]]> = [
  ["filipino", ["filipino", "fil"]],
  ["komunikasyon at pananaliksik", ["komunikasyon at pananaliksik", "kom pan"]],
  ["pagbasa at pagsusuri", ["pagbasa at pagsusuri"]],
  ["english", ["english", "eng"]],
  ["oral communication", ["oral communication"]],
  ["reading and writing", ["reading and writing"]],
  ["21st century literature", ["21st century literature", "21st century lit"]],
  ["mathematics", ["mathematics", "math"]],
  ["general mathematics", ["general mathematics", "gen math"]],
  ["statistics and probability", ["statistics and probability", "statistics", "probability"]],
  ["science", ["science", "sci"]],
  ["earth and life science", ["earth and life science"]],
  ["earth science", ["earth science"]],
  ["physical science", ["physical science"]],
  ["araling panlipunan", ["araling panlipunan", "ap"]],
  ["understanding culture society and politics", ["understanding culture society and politics", "ucsp"]],
  ["contemporary philippine arts", ["contemporary philippine arts"]],
  ["edukasyon sa pagpapakatao", ["edukasyon sa pagpapakatao", "esp", "edukasyon sa pagpapahalaga"]],
  ["personal development", ["personal development"]],
  ["introduction to philosophy", ["introduction to philosophy"]],
  ["mapeh", ["mapeh", "music", "arts", "physical education", "pe", "health", "pe and health"]],
  [
    "technology and livelihood education",
    ["technology and livelihood education", "tle", "epp", "technology livelihood"],
  ],
  ["empowerment technologies", ["empowerment technologies"]],
  ["media and information literacy", ["media and information literacy"]],
  ["entrepreneurship", ["entrepreneurship"]],
  ["mother tongue", ["mother tongue", "mtb", "mother tongue based"]],
  ["practical research", ["practical research", "practical research 1", "practical research 2", "inquiries investigations and immersion", "research"]],
  // Previous-school trade electives (kept distinct — never merged).
  ["icf", ["icf", "icff"]],
  ["trade drawing", ["trade drawing", "trade draw"]],
];

const ALIAS_LOOKUP = new Map<string, string>();
for (const [canonical, aliases] of ALIAS_TO_CANONICAL) {
  for (const a of aliases) ALIAS_LOOKUP.set(a, canonical);
}

export function normalizeSubjectName(raw: string): string {
  let s = raw.toLowerCase().trim();
  // Strip grade markers: "math 7", "mathematics vii", "grade 7 math",
  // "g7 filipino", standalone "7"/"10" tokens.
  s = s
    .replace(/\b(g(7|8|9|10|11|12)|grade\s*\d{1,2}|vii|viii|ix|x|xi|xii|7|8|9|10|11|12)\b/gi, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "";
  // Exact alias hit first (handles multi-word aliases like "oral communication").
  const direct = ALIAS_LOOKUP.get(s);
  if (direct) return direct;
  // Single-token abbreviation expansion.
  const tokens = s.split(" ").map((t) => ALIAS_LOOKUP.get(t) ?? t);
  const joined = tokens.join(" ").replace(/\s+/g, " ").trim();
  return ALIAS_LOOKUP.get(joined) ?? joined;
}

export interface OcrSubjectCandidate {
  rawName: string;
  norm: string;
}

export interface RatedSubjectCandidate extends OcrSubjectCandidate {
  /** Final rating 0–100. Null = blank/not input → means NOT TAKEN (policy). */
  rating: number | null;
  /** Grade the row belongs to (G7..G12). Null = untagged → current grade only. */
  gradeLevel: string | null;
  /** Quarterly ratings Q1–Q4 in column order. Null = unreadable/split unknown. */
  quarters: Array<number | null> | null;
  /**
   * SHS only: per-semester final grades [1st sem, 2nd sem]. Semester tables
   * show each semester's own final even when a subject spans both.
   */
  semFinals?: Array<number | null> | null;
  /** PASSED / FAILED / PROMOTED … as printed, else null. */
  remarks: string | null;
}

/** First remark word found in a line/row, uppercased, else null. */
export function extractRemark(text: string): string | null {
  const m = text.match(/passed|failed|retained|promoted|conditional|credited|remedial/i);
  return m ? m[0].toUpperCase() : null;
}

/**
 * Split an ordered number list (column order) into quarterlies + final:
 * - 5+: quarters = first 4, final = 5th.
 * - exactly 1: quarters unknown (null), final = it.
 * - 2–4: quarters unknown (null), final = last.
 */
export function splitQuartersFinal(numbers: number[]): {
  quarters: Array<number | null> | null;
  final: number | null;
} {
  if (numbers.length === 0) return { quarters: null, final: null };
  if (numbers.length === 1) return { quarters: null, final: numbers[0] };
  if (numbers.length >= 5) return { quarters: numbers.slice(0, 4), final: numbers[4] };
  return { quarters: null, final: numbers[numbers.length - 1] };
}

const GRADE_LEVELS = ["G7", "G8", "G9", "G10", "G11", "G12"] as const;

const ROMAN_TO_GRADE: Record<string, string> = {
  vii: "G7",
  viii: "G8",
  ix: "G9",
  x: "G10",
  xi: "G11",
  xii: "G12",
};

const GRADE_ORDER_LOCAL = ["G7", "G8", "G9", "G10", "G11", "G12"] as const;

/** Max of grade codes (G7..G12). Null when none present. */
export function maxGradeLevel(codes: Array<string | null | undefined>): string | null {
  let best = -1;
  for (const c of codes) {
    if (!c) continue;
    const i = (GRADE_ORDER_LOCAL as readonly string[]).indexOf(c.toUpperCase());
    if (i > best) best = i;
  }
  return best >= 0 ? GRADE_ORDER_LOCAL[best] : null;
}

/**
 * "Classified as Grade: 7" (SF10 scholastic block header) — the authoritative
 * grade basis for every subject row below it until the next block.
 */
export function isClassifiedGradeLine(text: string): boolean {
  return /classified\s*as\s*grade/i.test(text);
}

export function parseClassifiedGrade(text: string): string | null {
  if (!isClassifiedGradeLine(text)) return null;
  const tokens = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/);
  for (const t of tokens) {
    const m = t.match(/^g?(7|8|9|10|11|12)$/);
    if (m) return `G${m[1]}`;
    if (/^(vii|viii|ix|x|xi|xii)$/.test(t) && ROMAN_TO_GRADE[t]) return ROMAN_TO_GRADE[t];
  }
  return null;
}

/** Detect a grade header in a line/row: "Grade 8", "G8", "VII", "K to 12 - Grade 9". */
export function detectGradeLevelFromText(text: string): string | null {
  const lowered = ` ${text.toLowerCase()} `;
  const gMatch = lowered.match(/(?<![a-z0-9])g\s*(7|8|9|10|11|12)(?![0-9])/);
  if (gMatch) return `G${gMatch[1]}`;
  const gradeMatch = lowered.match(/grade\s*(7|8|9|10|11|12)(?![0-9])/);
  if (gradeMatch) return `G${gradeMatch[1]}`;
  const romanMatch = lowered.match(/(?<![a-z])(vii|viii|ix|x|xi|xii)(?![a-z])/);
  if (romanMatch) return ROMAN_TO_GRADE[romanMatch[1]] ?? null;
  return null;
}

/** Parse a cell/text rating. Returns null for blank/not-input. 0 stays 0 (not taken). */
export function parseRating(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    if (value < 0 || value > 100) return null;
    return Math.round(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Skip school years (2024, 2024-2025) and LRN-length numbers.
    if (/^\d{4}\s*([-–]\s*\d{2,4})?$/.test(trimmed)) return null;
    if (/^\d{9,}$/.test(trimmed.replace(/\s+/g, ""))) return null;
    const m = trimmed.match(/(\d{1,3})(?:\.\d+)?/);
    if (!m) return null;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n < 0 || n > 100) return null;
    return n;
  }
  return null;
}

const CANONICAL_LABELS = ALIAS_TO_CANONICAL.map(([canonical]) => canonical);

/** Scan free text for known subject mentions. Deduplicated by normalized key. */
export function extractSubjectsFromText(text: string): OcrSubjectCandidate[] {
  const lowered = ` ${text.toLowerCase()} `;
  const found = new Map<string, string>();
  const allPatterns: Array<{ label: string; pattern: string }> = [];
  for (const [canonical, aliases] of ALIAS_TO_CANONICAL) {
    allPatterns.push({ label: canonical, pattern: canonical });
    for (const a of aliases) {
      if (a !== canonical) allPatterns.push({ label: canonical, pattern: a });
    }
  }
  // Longest patterns first so "physical education" wins over "pe".
  allPatterns.sort((a, b) => b.pattern.length - a.pattern.length);
  for (const { label, pattern } of allPatterns) {
    const norm = normalizeSubjectName(label);
    if (found.has(norm)) continue;
    // Word-boundary match; short tokens (pe, ap, fil) require strict boundaries.
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<![a-z])${escaped}(?![a-z])`);
    if (re.test(lowered)) {
      found.set(norm, label);
    }
  }
  return CANONICAL_LABELS.filter((label) => found.has(normalizeSubjectName(label))).map(
    (label) => ({ rawName: label, norm: normalizeSubjectName(label) }),
  );
}

interface SubjectPattern {
  label: string;
  norm: string;
  pattern: string;
}

let cachedPatterns: SubjectPattern[] | null = null;

function getSubjectPatterns(): SubjectPattern[] {
  if (cachedPatterns) return cachedPatterns;
  const all: SubjectPattern[] = [];
  for (const [canonical, aliases] of ALIAS_TO_CANONICAL) {
    all.push({ label: canonical, norm: normalizeSubjectName(canonical), pattern: canonical });
    for (const a of aliases) {
      if (a !== canonical) all.push({ label: canonical, norm: normalizeSubjectName(canonical), pattern: a });
    }
  }
  all.sort((a, b) => b.pattern.length - a.pattern.length);
  cachedPatterns = all;
  return all;
}

/**
 * Rows that are never subjects (headers, totals, metadata) — shared by the
 * known-subject matcher and the unknown-subject fallback below.
 */
export function isNonSubjectRow(text: string): boolean {
  const lowered = ` ${text.toLowerCase()} `;
  return /(learning areas|final rating|general average|total|average|remedial|conduct|attendance|school year|deped|form 13[0-9]|learner's|name of learner|lrn|sex|birth)/.test(
    lowered,
  );
}

/**
 * Extra blocklist for the unknown-subject fallback: metadata rows that can
 * carry numbers (IDs, dates) but are never learning areas.
 */
const UNKNOWN_SUBJECT_BLOCK =
  /classified\s*as\s*grade|school|section|adviser|signature|division|district|region|address|certif|principal|republic|department/i;

export function isBlockedUnknownRow(text: string): boolean {
  return isNonSubjectRow(text) || UNKNOWN_SUBJECT_BLOCK.test(text);
}

/** Name-shaped cell/line start ("STVE", not "86" or a sentence). */
export function looksLikeSubjectName(text: string): boolean {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length >= 2 && t.length <= 80 && /[a-zA-Z]{2,}/.test(t) && !/^\d/.test(t);
}

/**
 * Match a single cell/line to one subject (longest pattern wins).
 * Returns null when the text is a header/total/label rather than a subject.
 */
export function matchSingleSubject(text: string): OcrSubjectCandidate | null {
  const span = matchSingleSubjectSpan(text);
  return span ? { rawName: span.label, norm: span.norm } : null;
}

/** Same match plus where it occurred (so ratings scan only what follows). */
export function matchSingleSubjectSpan(
  text: string,
): { label: string; norm: string; index: number; length: number } | null {
  const lowered = ` ${text.toLowerCase()} `;
  // Skip obvious non-subject rows.
  if (isNonSubjectRow(text)) {
    return null;
  }
  for (const p of getSubjectPatterns()) {
    const escaped = p.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = new RegExp(`(?<![a-z])${escaped}(?![a-z])`).exec(lowered);
    if (m && m.index !== undefined) {
      return { label: p.label, norm: p.norm, index: m.index, length: m[0].length };
    }
  }
  return null;
}

/**
 * Year-aware extraction from flat text (PDF path): tracks grade headers
 * line by line, captures a 0–100 rating near each subject mention.
 * Policy: rating null/0 later means NOT TAKEN; any other score = taken.
 */
export function extractRatedSubjectsFromText(text: string): RatedSubjectCandidate[] {
  const found = new Map<string, RatedSubjectCandidate>();
  let currentGrade: string | null = null;
  // A bare grade token alone on the next line (PDF one-cell-per-line layout
  // where "Classified as Grade:" and "7" land on separate lines).
  let awaitingGrade = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    // "Classified as Grade: N" opens a new scholastic block — it is the
    // grade basis for every subject row below it.
    if (isClassifiedGradeLine(line)) {
      const classified = parseClassifiedGrade(line);
      currentGrade = classified;
      awaitingGrade = !classified;
      continue;
    }
    if (awaitingGrade) {
      awaitingGrade = false;
      const bare = line.match(/^\s*(?:grade\s*)?(?:g\s*)?(7|8|9|10|11|12|vii|viii|ix|x|xi|xii)\s*$/i);
      if (bare && !matchSingleSubject(line)) {
        const token = bare[1].toLowerCase();
        currentGrade = ROMAN_TO_GRADE[token] ?? `G${token}`;
        continue;
      }
    }
    const headerGrade = detectGradeLevelFromText(line);
    // Pure header line (no subject): switch section, skip.
    if (headerGrade && !matchSingleSubject(line)) {
      currentGrade = headerGrade;
      continue;
    }
    // NOTE: subject rows never switch the section - a trailing '7/8/9'
    // in the name is part of the name, not a grade tag.
    const span = matchSingleSubjectSpan(line);
    // Full name as written in the file, trailing number included
    // ("ICF 7", "ICFF 8", "TRADE DRAWING 7") - one row each in add-ons.
    let rawName: string;
    let norm: string;
    let afterSubject: string;
    if (span) {
      const matchedAsWritten = line
        .slice(span.index - 1, span.index + span.length - 1)
        .trim()
        .replace(/\s+/g, " ");
      afterSubject = line.slice(span.index + span.length - 1);
      // A trailing grade tag on the name ("TRADE DRAWING 7 80…") — drop one
      // leading grade token when real ratings follow it.
      const leadGrade = afterSubject.match(
        /^\s*(g\s*)?(7|8|9|10|11|12|vii|viii|ix|x|xi|xii)\b(?=\s+\d)/i,
      );
      const gradeSuffix = leadGrade ? leadGrade[0].trim().replace(/\s+/g, " ") : "";
      rawName =
        (gradeSuffix ? `${matchedAsWritten} ${gradeSuffix}` : matchedAsWritten)
          .trim()
          .replace(/\s+/g, " ") || span.label;
      norm = span.norm;
      afterSubject = leadGrade ? afterSubject.slice(leadGrade[0].length) : afterSubject;
    } else {
      // Unknown learning area kept as on record (e.g. "STVE …"): the row
      // must be name-shaped with real quarterly grades, never metadata.
      if (isBlockedUnknownRow(line)) continue;
      const numAt = line.search(/\d/);
      if (numAt <= 0) continue;
      const cand = line.slice(0, numAt).trim().replace(/\s+/g, " ");
      if (!looksLikeSubjectName(cand)) continue;
      const gradeTail = line
        .slice(numAt)
        .match(/^\s*(g\s*)?(7|8|9|10|11|12|vii|viii|ix|x|xi|xii)\b(?=\s+\d)/i);
      const suffix = gradeTail ? gradeTail[0].trim().replace(/\s+/g, " ") : "";
      rawName = (suffix ? `${cand} ${suffix}` : cand).trim().replace(/\s+/g, " ");
      norm = normalizeSubjectName(rawName);
      if (!norm) continue;
      afterSubject = line.slice(numAt + (gradeTail ? gradeTail[0].length : 0));
    }
    const hit = { rawName, norm };
    // Unknown learning areas need real quarterly grades, not a lone number.
    if (!span) {
      const probe = (afterSubject.match(/\d{1,3}(?:\.\d+)?/g) ?? [])
        .map((n) => parseRating(n))
        .filter((v): v is number => v !== null);
      if (probe.length < 3) continue;
    }
    const withoutGrade = afterSubject.replace(/20\d{2}(\s*[-–]\s*\d{2,4})?/g, " ");
    const numbers = (withoutGrade.match(/\d{1,3}(?:\.\d+)?/g) ?? [])
      .map((n) => parseRating(n))
      .filter((v): v is number => v !== null);
    // PDF text runs appear once (no merge repetition), so no collapsing here.
    let parsed = splitQuartersFinal(numbers);
    // Single grade-number lines (e.g. "Math 7" with no rating) would falsely
    // take 7 as rating — guard: if the only number equals the grade digit,
    // treat as no rating.
    if (numbers.length === 1 && currentGrade) {
      const only = numbers[0];
      if (only === Number(currentGrade.slice(1))) parsed = { quarters: null, final: null };
    }
    const key = `${currentGrade ?? "?"}|${hit.norm}|${hit.rawName.toUpperCase()}`;
    const existing = found.get(key);
    if (!existing || (existing.rating == null && parsed.final != null)) {
      found.set(key, {
        rawName: hit.rawName,
        norm: hit.norm,
        rating: parsed.final,
        gradeLevel: currentGrade,
        quarters: parsed.quarters,
        remarks: extractRemark(line),
      });
    }
  }
  return [...found.values()];
}
