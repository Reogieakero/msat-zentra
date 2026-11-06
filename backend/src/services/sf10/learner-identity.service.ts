// Learner identity extraction from SF10 files (no pre-selected learner).
// LRN is the strong key; the 4-part Philippine name (last, first, middle,
// suffix) is parsed from the "Learner's Information" block whether the file
// lays it out as split fields or a single "Last, First M. Suffix" line.

export interface LearnerIdentity {
  lrn: string | null;
  lastName: string | null;
  firstName: string | null;
  middleName: string | null;
  suffix: string | null;
  /** Display form: "Last, First Middle Suffix". Null when nothing found. */
  fullName: string | null;
  /** 0–1 heuristic: LRN + name-part coverage. */
  confidence: number;
}

const SUFFIXES = new Set(["JR", "SR", "II", "III", "IV", "V", "VI"]);

function cleanToken(token: string): string {
  return token.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function cleanNamePart(part: string): string {
  return part
    .toUpperCase()
    .replace(/[.,;:"'()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** DepEd LRNs are 12 digits. Prefer 1-led, accept any 12-digit fallback. */
export function extractLrn(text: string): string | null {
  const spaced = ` ${text} `;
  const strong = spaced.match(/(?<![0-9])1[0-9]{11}(?![0-9])/);
  if (strong) return strong[0];
  const any = spaced.match(/(?<![0-9])[0-9]{12}(?![0-9])/);
  return any ? any[0] : null;
}

function pullSuffix(tokens: string[]): { tokens: string[]; suffix: string | null } {
  if (tokens.length === 0) return { tokens, suffix: null };
  const last = cleanToken(tokens[tokens.length - 1]);
  if (SUFFIXES.has(last)) {
    return { tokens: tokens.slice(0, -1), suffix: tokens[tokens.length - 1].replace(/\./g, "").toUpperCase() };
  }
  return { tokens, suffix: null };
}

/**
 * Parse a single-line name in either order:
 * - "DELA CRUZ, JUAN A. JR" (comma → left is last name)
 * - "JUAN A. DELA CRUZ" (no comma → last token cluster is last name)
 */
export function parseFullName(raw: string): Omit<LearnerIdentity, "lrn" | "confidence" | "fullName"> {
  const empty = { lastName: null, firstName: null, middleName: null, suffix: null };
  // Split on the comma BEFORE cleaning (cleanNamePart strips punctuation).
  const commaIdx = raw.indexOf(",");
  if (commaIdx >= 0) {
    const lastName = cleanNamePart(raw.slice(0, commaIdx)) || null;
    let tokens = cleanNamePart(raw.slice(commaIdx + 1)).split(/\s+/).filter(Boolean);
    const pulled = pullSuffix(tokens);
    tokens = pulled.tokens;
    if (tokens.length === 0) return { ...empty, lastName, suffix: pulled.suffix };
    return {
      lastName,
      firstName: tokens[0] || null,
      middleName: tokens.length > 1 ? tokens.slice(1).join(" ") : null,
      suffix: pulled.suffix,
    };
  }
  const text = cleanNamePart(raw);
  if (!text || text.split(" ").length < 2) return empty;
  let tokens = text.split(/\s+/).filter(Boolean);
  const pulled = pullSuffix(tokens);
  tokens = pulled.tokens;
  if (tokens.length < 2) return { ...empty, suffix: pulled.suffix };
  // No comma: first token = first name, last token = last name, rest = middle.
  // (Multi-word last names without comma stay approximate — LRN decides.)
  return {
    lastName: tokens[tokens.length - 1],
    firstName: tokens[0],
    middleName: tokens.length > 2 ? tokens.slice(1, -1).join(" ") : null,
    suffix: pulled.suffix,
  };
}

export function formatLearnerName(parts: {
  lastName: string | null;
  firstName: string | null;
  middleName: string | null;
  suffix: string | null;
}): string | null {
  if (!parts.lastName && !parts.firstName) return null;
  const head = [parts.lastName, parts.firstName].filter(Boolean).join(", ");
  const tail = [parts.middleName, parts.suffix].filter(Boolean).join(" ");
  return tail ? `${head} ${tail}` : head;
}

function confidenceFor(identity: Omit<LearnerIdentity, "confidence" | "fullName">): number {
  let score = 0;
  if (identity.lrn) score += 0.5;
  if (identity.lastName) score += 0.2;
  if (identity.firstName) score += 0.15;
  if (identity.middleName) score += 0.1;
  if (identity.suffix) score += 0.05;
  return Math.min(1, Math.round(score * 100) / 100);
}

/** A picked "value" that is really another label (prevents garbage names). */
function isLabelLike(cell: string): boolean {
  return /(last|first|middle)\s*name|learner\s*reference|reference\s*number|\(lrn\)|\blrn\b|birthdate|\bbirth\b|\bsex\b|\bschool\b|\bgrade\b|deped|division|district|\bregion\b|\bsection\b|subject|rating|average|remedial|enrolment|citation/i.test(cell);
}

/** Cut "Jones FIRST NAME Tammy ..." down to "Jones" at the next label word. */
function cutAtNextLabel(value: string): string {
  const idx = value.search(
    /learner\s*reference|\b(first|middle|last)\s*name\b|\bsuffix\b|\bname\s*ext\b|reference\s*number|\(lrn\)|\blrn\b|birthdate|\bbirth\b|\bsex\b|\bschool\b|\bgrade\b/i,
  );
  return (idx >= 0 ? value.slice(0, idx) : value).trim();
}

/**
 * Label-near-value scan over flat text lines. Handles:
 * - "Last Name: DELA CRUZ" (same line, colon)
 * - "Last Name" NL "DELA CRUZ" (value on next non-label line)
 * - "Name: DELA CRUZ, JUAN A." (single-line fallback)
 */
export function extractIdentityFromText(text: string): LearnerIdentity {
  const lrn = extractLrn(text);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const field = (label: RegExp): string | null => {
    const flags = label.flags.includes("i") ? label.flags : `${label.flags}i`;
    const re = new RegExp(label.source, flags);
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(re);
      if (!m || m.index === undefined) continue;
      // Value AFTER this label (same shared row), cut at the next label.
      const afterLabel = cutAtNextLabel(
        lines[i].slice(m.index + m[0].length).replace(/^[\s:.\-]+/, ""),
      );
      if (afterLabel && !isLabelLike(afterLabel)) return afterLabel;
      // Value on the next line — must itself not be another label row.
      const next = cutAtNextLabel(lines[i + 1]?.trim() ?? "");
      if (next && !isLabelLike(next)) return next;
    }
    return null;
  };

  let lastName = field(/last\s*name/i);
  let firstName = field(/first\s*name/i);
  let middleName = field(/middle\s*name/i);
  let suffix = field(/suffix|ext\.?\s*name/i);
  if (suffix) suffix = cleanToken(suffix).replace(/\./g, "") || null;
  if (suffix && !SUFFIXES.has(suffix)) suffix = null;

  if (!lastName && !firstName) {
    const nameLine = lines.find((l) => /^name\s*[:\-]/i.test(l));
    if (nameLine) {
      const parsed = parseFullName(nameLine.split(/[:\-]/).slice(1).join(" "));
      lastName = parsed.lastName;
      firstName = parsed.firstName;
      middleName = parsed.middleName;
      suffix = parsed.suffix;
    }
  }

  const parts = {
    lrn,
    lastName: lastName ? cleanNamePart(lastName) : null,
    firstName: firstName ? cleanNamePart(firstName) : null,
    middleName: middleName ? cleanNamePart(middleName) : null,
    suffix,
  };
  return { ...parts, fullName: formatLearnerName(parts), confidence: confidenceFor(parts) };
}

/** Cell-grid version for XLSX: same-row labels first, header-row fallback. */
export function extractIdentityFromCells(grid: string[][]): LearnerIdentity {
  const lrn = extractLrn(grid.map((r) => r.join(" ")).join("\n"));
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const isSuffixLabel = (n: string) => n === "suffix" || n === "extname" || n.includes("ext");
  let lastName: string | null = null;
  let firstName: string | null = null;
  let middleName: string | null = null;
  let suffix: string | null = null;

  // Layout B (real SF10 shape): label and value share one row —
  // "LAST NAME: | Jones | FIRST NAME: | Tammy | ... | MIDDLE NAME: | Mccullough".
  for (const row of grid) {
    row.forEach((cell, i) => {
      const n = norm(cell);
      const value = row.slice(i + 1).find((c) => c.trim())?.trim() ?? null;
      // Values must look like names: not another label, and contain a letter
      // (bare numbers such as ratings or LRNs are never names).
      if (!value || isLabelLike(value) || !/[a-zA-Z]/.test(value)) return;
      if (n === "lastname" && !lastName) lastName = value;
      else if (n === "firstname" && !firstName) firstName = value;
      else if (n === "middlename" && !middleName) middleName = value;
      else if (isSuffixLabel(n) && !suffix) {
        const s = cleanToken(value).replace(/\./g, "");
        suffix = s && SUFFIXES.has(s) ? s : null;
      }
    });
    if (lastName && firstName) break;
  }

  // Layout A fallback: header row "LAST NAME | FIRST NAME | ..." with values
  // in a row below. Only accepted when the picked cells are real values.
  if (!lastName && !firstName) {
    for (let r = 0; r < grid.length; r++) {
      const heads = grid[r].map(norm);
      const li = heads.findIndex((h) => h === "lastname");
      if (li < 0) continue;
      const col = (name: string) => heads.findIndex((h) => h === name);
      const fi = col("firstname");
      const mi = col("middlename");
      const si = heads.findIndex((h) => h === "suffix" || h === "extname" || h.includes("ext"));
      for (let k = r + 1; k < Math.min(r + 4, grid.length); k++) {
        const row = grid[k];
        const pick = (i: number) => {
          const v = i >= 0 ? (row[i]?.trim() ?? null) : null;
          if (!v || isLabelLike(v) || !/[a-zA-Z]/.test(v)) return null;
          return v;
        };
        // Skip repeated header rows.
        if (row.some((c) => /^(last|first|middle)\s*name$/i.test(c.trim()))) continue;
        lastName = lastName ?? pick(li);
        firstName = firstName ?? pick(fi);
        middleName = middleName ?? pick(mi);
        const sfx = pick(si);
        suffix = suffix ?? (sfx ? cleanToken(sfx).replace(/\./g, "") || null : null);
        if (lastName || firstName) break;
      }
      if (lastName || firstName) break;
    }
  }

  // Layout C: single-line "Name: ..." anywhere in the grid.
  if (!lastName && !firstName) {
    const flat = grid.map((r) => r.join(" ")).join("\n");
    const parsed = extractIdentityFromText(flat);
    lastName = parsed.lastName;
    firstName = parsed.firstName;
    middleName = parsed.middleName;
    suffix = parsed.suffix;
  }

  if (suffix && !SUFFIXES.has(suffix)) suffix = null;
  const parts = {
    lrn,
    lastName: lastName ? cleanNamePart(lastName) : null,
    firstName: firstName ? cleanNamePart(firstName) : null,
    middleName: middleName ? cleanNamePart(middleName) : null,
    suffix,
  };
  return { ...parts, fullName: formatLearnerName(parts), confidence: confidenceFor(parts) };
}
