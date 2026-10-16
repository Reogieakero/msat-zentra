// Minimal same-row formula evaluation for school SF10 templates.
//
// The DepEd-style workbooks compute FINAL RATING and REMARKS with formulas
// (e.g. ROUND(AVERAGE(...)) and IF(final>=75,"PASSED","FAILED")) but are
// often saved WITHOUT cached results — Excel shows 87 / PASSED on screen
// while the file stores nothing, so a naive reader sees blanks. When every
// referenced cell resolves to a value in the same row, the result is
// deterministic from the file's own numbers and safe to use; anything else
// (cross-row refs, unknown functions) evaluates to blank = unread.

export type FormulaCell = number | string | null; // null = blank / unread

type Val = number | string | boolean | null | Val[];

function colLettersToIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function truthy(v: Val): boolean {
  if (v === null) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  return v !== "";
}

function asNumber(v: Val): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

interface Parser {
  text: string;
  pos: number;
  row: FormulaCell[];
  rowNumber: number;
}

function skipWs(p: Parser): void {
  while (p.pos < p.text.length && /\s/.test(p.text[p.pos])) p.pos++;
}

function matchOp(p: Parser, ...ops: string[]): string | null {
  skipWs(p);
  for (const op of ops) {
    if (p.text.slice(p.pos, p.pos + op.length).toUpperCase() === op.toUpperCase()) {
      // Avoid matching a function-name prefix of a longer identifier.
      const after = p.text[p.pos + op.length] ?? "";
      if (/[A-Za-z]/.test(op[op.length - 1]) && /[A-Za-z0-9_.]/.test(after)) continue;
      p.pos += op.length;
      return op;
    }
  }
  return null;
}

function parseExpr(p: Parser): Val {
  return parseComparison(p);
}

function compareVals(op: string, a: Val, b: Val): Val {
  if (a === null || b === null) {
    // Excel blanks: a blank cell equals "" and 0 (the OR(U25="",…) guards
    // in school templates rely on this); ordering against blank is blank.
    if (op !== "=" && op !== "<>") return null;
    const other = a === null ? b : a;
    const eq = other === null || other === "" || other === 0 || other === false;
    return op === "=" ? eq : !eq;
  }
  if (typeof a === "number" && typeof b === "number") {
    switch (op) {
      case "=": return a === b;
      case "<>": return a !== b;
      case ">": return a > b;
      case "<": return a < b;
      case ">=": return a >= b;
      case "<=": return a <= b;
    }
  }
  if (typeof a === "string" && typeof b === "string") {
    switch (op) {
      case "=": return a === b;
      case "<>": return a !== b;
      case ">": return a > b;
      case "<": return a < b;
      case ">=": return a >= b;
      case "<=": return a <= b;
    }
  }
  // Mixed types: only equality is meaningful (Excel orders types, we blank).
  if (op === "=") return false;
  if (op === "<>") return true;
  return null;
}

function parseComparison(p: Parser): Val {
  const a = parseConcat(p);
  const op = matchOp(p, "<>", "<=", ">=", "=", "<", ">");
  if (!op) return a;
  return compareVals(op, a, parseConcat(p));
}

function parseConcat(p: Parser): Val {
  let v = parseTerm(p);
  while (matchOp(p, "&")) {
    const rhs = parseTerm(p);
    if (v === null || rhs === null) return null;
    v = String(v) + String(rhs);
  }
  return v;
}

function parseTerm(p: Parser): Val {
  let v = parseFactor(p);
  for (;;) {
    if (matchOp(p, "+")) {
      const rhs = parseFactor(p);
      const a = asNumber(v);
      const b = asNumber(rhs);
      v = a === null || b === null ? null : a + b;
    } else if (matchOp(p, "-")) {
      const rhs = parseFactor(p);
      const a = asNumber(v);
      const b = asNumber(rhs);
      v = a === null || b === null ? null : a - b;
    } else {
      return v;
    }
  }
}

function parseFactor(p: Parser): Val {
  let v = parseUnary(p);
  for (;;) {
    if (matchOp(p, "*")) {
      const rhs = parseUnary(p);
      const a = asNumber(v);
      const b = asNumber(rhs);
      v = a === null || b === null ? null : a * b;
    } else if (matchOp(p, "/")) {
      const rhs = parseUnary(p);
      const a = asNumber(v);
      const b = asNumber(rhs);
      v = a === null || b === null || b === 0 ? null : a / b;
    } else if (matchOp(p, "^")) {
      const rhs = parseUnary(p);
      const a = asNumber(v);
      const b = asNumber(rhs);
      v = a === null || b === null ? null : Math.pow(a, b);
    } else {
      return v;
    }
  }
}

function parseUnary(p: Parser): Val {
  if (matchOp(p, "-")) {
    const v = asNumber(parseUnary(p));
    return v === null ? null : -v;
  }
  if (matchOp(p, "+")) return parseUnary(p);
  return parsePrimary(p);
}

function resolveRef(letters: string, digits: string, p: Parser): Val {
  if (Number(digits) !== p.rowNumber) return null; // same-row only
  const idx = colLettersToIndex(letters);
  if (idx < 0 || idx >= p.row.length) return null;
  const v = p.row[idx];
  return v === undefined ? null : v;
}

function parsePrimary(p: Parser): Val {
  skipWs(p);
  const rest = p.text.slice(p.pos);
  // String literal ("..." with "" escape).
  if (rest.startsWith('"')) {
    const m = rest.match(/^"((?:[^"]|"")*)"/);
    if (!m) return null;
    p.pos += m[0].length;
    return m[1].replace(/""/g, '"');
  }
  // Parenthesized group.
  if (rest.startsWith("(")) {
    p.pos++;
    const v = parseExpr(p);
    skipWs(p);
    if (p.text[p.pos] !== ")") return null;
    p.pos++;
    return v;
  }
  // Cell range A1:B2 (same row only).
  let m = rest.match(/^\$?([A-Za-z]+)\$?(\d+)\s*:\s*\$?([A-Za-z]+)\$?(\d+)/);
  if (m) {
    p.pos += m[0].length;
    if (Number(m[2]) !== p.rowNumber || Number(m[4]) !== p.rowNumber) return [] as unknown as Val;
    const lo = colLettersToIndex(m[1]);
    const hi = colLettersToIndex(m[3]);
    const out: Val[] = [];
    for (let c = Math.min(lo, hi); c <= Math.max(lo, hi); c++) {
      out.push(c < p.row.length ? (p.row[c] ?? null) : null);
    }
    return out as unknown as Val;
  }
  // Cell ref like U25 / $U$25 (a function name is never bare letters+digits).
  m = rest.match(/^\$?([A-Za-z]+)\$?(\d+)/);
  if (m && !/^\s*\(/.test(rest.slice(m[0].length))) {
    p.pos += m[0].length;
    return resolveRef(m[1], m[2], p);
  }
  // Number (with optional % suffix).
  m = rest.match(/^\d+(?:\.\d+)?/);
  if (m) {
    p.pos += m[0].length;
    let v = Number(m[0]);
    skipWs(p);
    if (p.text[p.pos] === "%") {
      p.pos++;
      v /= 100;
    }
    return v;
  }
  // Booleans.
  if (/^TRUE\b/i.test(rest)) {
    p.pos += 4;
    return true;
  }
  if (/^FALSE\b/i.test(rest)) {
    p.pos += 5;
    return false;
  }
  // Function call.
  m = rest.match(/^([A-Za-z_][A-Za-z0-9_.]*)\s*\(/);
  if (m) {
    const name = m[1].toUpperCase();
    p.pos += m[0].length;
    const args: Val[] = [];
    skipWs(p);
    if (p.text[p.pos] === ")") {
      p.pos++;
    } else {
      for (;;) {
        args.push(parseExpr(p));
        skipWs(p);
        if (p.text[p.pos] === ",") {
          p.pos++;
          continue;
        }
        if (p.text[p.pos] === ")") {
          p.pos++;
          break;
        }
        return null;
      }
    }
    return callFn(name, args);
  }
  return null;
}

function numList(args: Val[]): number[] {
  const out: number[] = [];
  const flat: Val[] = [];
  for (const a of args) {
    if (Array.isArray(a)) flat.push(...(a as Val[]));
    else flat.push(a);
  }
  for (const v of flat) {
    const n = asNumber(v);
    if (n !== null) out.push(n);
  }
  return out;
}

function callFn(name: string, args: Val[]): Val {
  switch (name) {
    case "AVERAGE":
    case "AVERAGEA": {
      const nums = numList(args);
      if (nums.length === 0) return null;
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    }
    case "SUM": {
      return numList(args).reduce((a, b) => a + b, 0);
    }
    case "ROUND": {
      const x = asNumber(args[0]);
      if (x === null) return null;
      const d = args.length > 1 ? (asNumber(args[1]) ?? 0) : 0;
      const f = Math.pow(10, d);
      return Math.round(x * f) / f;
    }
    case "IF": {
      if (args.length < 2) return null;
      return truthy(args[0]) ? args[1] : (args.length > 2 ? args[2] : false);
    }
    case "IFERROR": {
      return args[0] === null ? (args.length > 1 ? args[1] : null) : args[0];
    }
    case "OR": {
      const flat = args.flatMap((a) => (Array.isArray(a) ? (a as Val[]) : [a]));
      const known = flat.filter((v) => v !== null);
      if (known.length === 0) return false;
      return known.some(truthy);
    }
    case "AND": {
      const flat = args.flatMap((a) => (Array.isArray(a) ? (a as Val[]) : [a]));
      const known = flat.filter((v) => v !== null);
      if (known.length === 0) return true;
      return known.every(truthy);
    }
    case "NOT": {
      return args[0] === null ? null : !truthy(args[0]);
    }
    case "ISERROR": {
      return args[0] === null;
    }
    case "ISBLANK": {
      return args[0] === null;
    }
    default:
      return null;
  }
}

/**
 * Evaluate one Excel formula using only same-row values.
 * @param row 1-based column array for the formula's own row (index 0 unused).
 * @returns number | string on success, null when not evaluable.
 */
export function evaluateFormula(
  formula: string,
  rowNumber: number,
  row: FormulaCell[],
): number | string | boolean | null {
  try {
    const expr = formula.trim().replace(/^=/, "");
    if (!expr) return null;
    const p: Parser = { text: expr, pos: 0, row, rowNumber };
    const v = parseExpr(p);
    skipWs(p);
    if (p.pos !== p.text.length) return null;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    // An empty-string result is a blank cell, not text.
    if (typeof v === "string") return v === "" ? null : v;
    return null;
  } catch {
    return null;
  }
}
