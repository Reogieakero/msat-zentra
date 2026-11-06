// Best-effort text extraction for SF10 uploads.
// - External worker first when OCR_WORKER_URL is configured.
// - Local fallbacks: digital-PDF text scraping, XLSX cell parsing (no OCR
//   needed — structured data, highest confidence).
// - Images without a worker return empty text so the record lands in
//   needs-review instead of failing the upload.

import { inflateSync } from "node:zlib";
import { evaluateFormula } from "./formula.service.js";
import { getEnv } from "../../config/env.js";
import { logger } from "../../lib/pino.js";
import {
  detectGradeLevelFromText,
  extractRatedSubjectsFromText,
  extractRemark,
  isBlockedUnknownRow,
  isClassifiedGradeLine,
  isNonSubjectRow,
  looksLikeSubjectName,
  matchSingleSubject,
  normalizeSubjectName,
  parseClassifiedGrade,
  parseRating,
  splitQuartersFinal,
  type RatedSubjectCandidate,
} from "./subject-aliases.js";

export interface OcrExtractOutput {
  rawText: string;
  confidence: number;
  engine: string;
  subjects: RatedSubjectCandidate[];
}

/** PDF byte string → text: UTF-16BE when BOM-marked, else WinAnsi bytes. */
function pdfBytesToText(bytes: number[]): string {
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let out = "";
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      const code = (bytes[i] << 8) | bytes[i + 1];
      out += code === 10 || code === 13 ? " " : code >= 32 ? String.fromCharCode(code) : "";
    }
    return out;
  }
  return bytes
    .map((b) => (b === 10 || b === 13 ? " " : b >= 32 && b < 127 ? String.fromCharCode(b) : ""))
    .join("");
}

/** Raw bytes of a hex-string token. */
function hexToBytes(digits: string): number[] {
  const clean = digits.replace(/\s+/g, "");
  const bytes: number[] = [];
  for (let i = 0; i + 1 < clean.length; i += 2) {
    const v = parseInt(clean.slice(i, i + 2), 16);
    if (Number.isFinite(v)) bytes.push(v);
  }
  return bytes;
}

/** Raw bytes of a parenthesized literal token (escapes + octal runs). */
function literalToBytes(inner: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === "\\" && i + 1 < inner.length) {
      const n = inner[i + 1];
      if (n >= "0" && n <= "7") {
        const oct = inner.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)?.[0] ?? "";
        bytes.push(parseInt(oct, 8));
        i += oct.length;
      } else {
        const map: Record<string, number> = {
          n: 10,
          r: 13,
          t: 9,
          b: 8,
          f: 12,
          "(": 40,
          ")": 41,
          "\\": 92,
        };
        bytes.push(map[n] ?? n.charCodeAt(0));
        i++;
      }
    } else {
      bytes.push(c.charCodeAt(0) & 0xff);
    }
  }
  return bytes;
}

interface PdfFontMap {
  codes: Map<number, string>;
  twoByte: boolean;
}

/** Glyph bytes → text through a font's ToUnicode map (fallback: encoding guess). */
function decodeBytes(bytes: number[], enc: PdfFontMap | undefined): string {
  if (!enc) return pdfBytesToText(bytes);
  if (enc.twoByte) {
    let out = "";
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      out += enc.codes.get((bytes[i] << 8) | bytes[i + 1]) ?? "";
    }
    return out;
  }
  return bytes.map((b) => enc.codes.get(b) ?? "").join("");
}

interface PdfObject {
  num: number;
  header: string;
  /** Inflated stream text, or null for non-streams / images / font programs. */
  text: string | null;
}

/** Split a PDF into indirect objects with inflated stream text. */
function readPdfObjects(latin: string): PdfObject[] {
  // Pass 1: locate objects; stream bodies are bounded by endstream for now.
  const raw: Array<{ num: number; header: string; dataStart: number }> = [];
  const objRe = /(\d+)\s+0\s+obj\b/g;
  let m: RegExpExecArray | null;
  while ((m = objRe.exec(latin)) !== null) {
    const num = Number(m[1]);
    const pos = m.index + m[0].length;
    const rest = latin.slice(pos);
    const sHit = /\bstream\r?\n/.exec(rest);
    const eHit = /\bendobj\b/.exec(rest);
    if (sHit && (!eHit || sHit.index < eHit.index)) {
      const header = rest.slice(0, sHit.index);
      const dataStart = pos + sHit.index + sHit[0].length;
      const es = latin.indexOf("endstream", dataStart);
      raw.push({ num, header, dataStart });
      const endObj = latin.indexOf("endobj", es < 0 ? dataStart : es);
      objRe.lastIndex = endObj < 0 ? dataStart : endObj + 6;
    } else if (eHit) {
      raw.push({ num, header: rest.slice(0, eHit.index), dataStart: -1 });
      objRe.lastIndex = pos + eHit.index + 6;
    } else {
      break;
    }
    if (raw.length > 20_000) break;
  }
  // Indirect /Length N 0 R values live in tiny value-only objects ("8 0 obj 4980 endobj").
  const lengths = new Map<number, number>();
  for (const o of raw) {
    if (o.dataStart < 0) {
      const v = o.header.match(/^\s*(\d+)\s*$/);
      if (v) lengths.set(o.num, Number(v[1]));
    }
  }
  // Pass 2: slice exact bodies (exact /Length beats endstream sniffing when
  // binary stream data happens to contain those bytes) and inflate.
  const out: PdfObject[] = [];
  for (const o of raw) {
    if (o.dataStart < 0) {
      out.push({ num: o.num, header: o.header, text: null });
      continue;
    }
    let dataEnd: number;
    const indir = o.header.match(/\/Length\s+(\d+)\s+0\s+R/);
    if (indir && lengths.has(Number(indir[1]))) {
      dataEnd = o.dataStart + (lengths.get(Number(indir[1])) as number);
    } else {
      const direct = o.header.match(/\/Length\s+(\d+)/);
      if (direct && !/\/Length\s+\d+\s+0\s+R/.test(o.header)) {
        dataEnd = o.dataStart + Number(direct[1]);
      } else {
        const es = latin.indexOf("endstream", o.dataStart);
        dataEnd = es < 0 ? o.dataStart : es;
      }
    }
    const data = latin.slice(o.dataStart, dataEnd);
    let text: string | null = null;
    if (!/\/Subtype\s*\/Image/.test(o.header) && !/\/FontFile/.test(o.header)) {
      if (/\/FlateDecode/.test(o.header)) {
        try {
          text = inflateSync(Buffer.from(data, "latin1")).toString("latin1");
        } catch {
          text = null;
        }
      } else {
        text = data;
      }
    }
    out.push({ num: o.num, header: o.header, text });
  }
  return out;
}

/** Parse one ToUnicode CMap stream into code → unicode. */
function parseCMap(cmap: string): PdfFontMap {
  const codes = new Map<number, string>();
  const u16 = (hex: string): string => {
    const clean = hex.replace(/\s+/g, "");
    let out = "";
    for (let i = 0; i + 4 <= clean.length; i += 4) {
      const v = parseInt(clean.slice(i, i + 4), 16);
      if (Number.isFinite(v)) out += v === 10 || v === 13 ? " " : String.fromCharCode(v);
    }
    return out;
  };
  const bfcharRe = /beginbfchar([\s\S]*?)endbfchar/g;
  let bf: RegExpExecArray | null;
  while ((bf = bfcharRe.exec(cmap)) !== null) {
    const re = /<([0-9A-Fa-f]+)>\s*(?:\[([^\]]*)\]|<([0-9A-Fa-f\s]+)>)/g;
    let r: RegExpExecArray | null;
    while ((r = re.exec(bf[1])) !== null) {
      const src = parseInt(r[1], 16);
      if (!Number.isFinite(src)) continue;
      if (r[2] !== undefined) {
        codes.set(src, u16(r[2].match(/<([0-9A-Fa-f\s]+)>/)?.[1] ?? ""));
      } else {
        codes.set(src, u16(r[3]));
      }
    }
  }
  for (const sec of cmap.match(/beginbfrange([\s\S]*?)endbfrange/g) ?? []) {
    const re = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:\[([^\]]*)\]|<([0-9A-Fa-f\s]+)>)/g;
    let r: RegExpExecArray | null;
    while ((r = re.exec(sec)) !== null) {
      const lo = parseInt(r[1], 16);
      const hi = parseInt(r[2], 16);
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) continue;
      if (r[3] !== undefined) {
        const dsts = [...r[3].matchAll(/<([0-9A-Fa-f\s]+)>/g)].map((d) => u16(d[1]));
        for (let c = lo; c <= hi; c++) codes.set(c, dsts[c - lo] ?? "");
      } else {
        const base = u16(r[4]);
        const baseCode = base.length > 0 ? base.charCodeAt(0) : 0;
        for (let c = lo; c <= hi; c++) codes.set(c, String.fromCharCode(baseCode + (c - lo)));
      }
    }
  }
  let twoByte = false;
  for (const k of codes.keys()) {
    if (k > 0xff) {
      twoByte = true;
      break;
    }
  }
  return { codes, twoByte };
}

/** Resource name (/F1) → font ToUnicode map, via page /Resources dicts. */
function buildFontMaps(objects: PdfObject[]): Map<string, PdfFontMap> {
  const cmaps = new Map<number, PdfFontMap>();
  for (const o of objects) {
    if (o.text && /begincmap|beginbfchar|beginbfrange/.test(o.text)) {
      cmaps.set(o.num, parseCMap(o.text));
    }
  }
  const fontToCMap = new Map<number, number>();
  for (const o of objects) {
    if (/\/BaseFont/.test(o.header)) {
      const t = o.header.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
      if (t) fontToCMap.set(o.num, Number(t[1]));
    }
  }
  const out = new Map<string, PdfFontMap>();
  const whole = objects.map((o) => o.header).join("\n");
  const resRe = /\/Font\s*<<([^>]*?)>>/g;
  let rm: RegExpExecArray | null;
  while ((rm = resRe.exec(whole)) !== null) {
    const pairRe = /\/(\S+)\s+(\d+)\s+0\s+R/g;
    let pm: RegExpExecArray | null;
    while ((pm = pairRe.exec(rm[1])) !== null) {
      const cmapNum = fontToCMap.get(Number(pm[2]));
      const cmap = cmapNum !== undefined ? cmaps.get(cmapNum) : undefined;
      if (cmap) out.set("/" + pm[1], cmap);
    }
  }
  return out;
}

/** Decode one content stream to row-shaped lines.
 * Sheets-style PDFs put every cell in its own BT..ET block positioned by Tm,
 * so cells are grouped into rows by their Y (tolerance 3 units), sorted
 * left-to-right by X, and joined — yielding one line per table row
 * ("English 77 82 99 90 87 PASSED") for the subject parser. Blocks without
 * positioning keep their own line. Fonts track across blocks in stream order.
 */
function decodeContentText(content: string, fonts: Map<string, PdfFontMap>): string[] {
  const fontOf = (text: string, fallback: PdfFontMap | undefined): PdfFontMap | undefined => {
    const hits = [
      ...text.matchAll(/\/([A-Za-z][A-Za-z0-9+]*)\s+-?\d+(?:\.\d+)?\s+Tf/g),
    ];
    let current = fallback;
    for (const h of hits) current = fonts.get("/" + h[1]) ?? current;
    return current;
  };
  const tokenRe = /\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>|-?\d+(?:\.\d+)?/g;
  const blockRe = /\bBT\b([\s\S]*?)\bET\b/g;
  type Cell = { x: number | null; y: number | null; text: string };
  const cells: Cell[] = [];
  let current: PdfFontMap | undefined;
  let cursor = 0;
  let bm: RegExpExecArray | null;
  while ((bm = blockRe.exec(content)) !== null) {
    current = fontOf(content.slice(cursor, bm.index), current);
    const body = bm[1];
    current = fontOf(body, current);
    const tm = [...body.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Tm/g)].pop();
    let buf = "";
    let gap = false;
    tokenRe.lastIndex = 0;
    let t: RegExpExecArray | null;
    while ((t = tokenRe.exec(body)) !== null) {
      const tok = t[0];
      if (tok.startsWith("(")) {
        const text = decodeBytes(literalToBytes(tok.slice(1, -1)), current);
        buf += (gap && buf ? " " : "") + text;
        gap = false;
      } else if (tok.startsWith("<")) {
        const text = decodeBytes(hexToBytes(tok.slice(1, -1)), current);
        buf += (gap && buf ? " " : "") + text;
        gap = false;
      } else if (Number(tok) <= -120) {
        // Kerning shift inside a TJ array = word/cell gap.
        gap = true;
      }
    }
    const line = buf.replace(/\s+/g, " ").trim();
    if (line) {
      cells.push({
        x: tm ? Number(tm[5]) : null,
        y: tm ? Number(tm[6]) : null,
        text: line,
      });
    }
    cursor = bm.index + bm[0].length;
  }
  // Group positioned cells into rows; unpositioned cells keep their own line.
  const rows: Array<{ y: number | null; cells: Cell[] }> = [];
  for (const c of cells) {
    if (c.x === null || c.y === null) {
      rows.push({ y: null, cells: [c] });
      continue;
    }
    let row = rows.find((r) => r.y !== null && Math.abs((r.y as number) - (c.y as number)) <= 3);
    if (!row) {
      row = { y: c.y, cells: [] };
      rows.push(row);
    }
    row.cells.push(c);
  }
  return rows.map((r) => {
    if (r.y === null) return r.cells[0].text;
    r.cells.sort((a, b) => (a.x as number) - (b.x as number));
    return r.cells.map((c) => c.text).join("  ");
  });
}

/**
 * Digital-PDF text extraction (no OCR worker needed): reads each content
 * stream's real text-showing ops — `(…)Tj`, `<…>Tj`, `[…]TJ` — decoding every
 * font through its own ToUnicode CMap, so custom-subset exports (Google
 * Sheets / Excel, ArialNarrow…) come out as real words instead of glyph-id
 * garbage. WinAnsi and UTF-16BE byte strings still decode without a map.
 * Cells are grouped into rows by their Tm position, so table rows stay
 * row-shaped for the subject parser. Scanned-image PDFs have no text ops
 * and still return "" (needs-review path).
 */
export function extractPdfText(buffer: Buffer): string {
  try {
    const latin = buffer.toString("latin1");
    const objects = readPdfObjects(latin);
    // Page content streams only (/Type /Page → /Contents): other streams
    // carrying text ops (patterns, annotations) are layout noise, not rows.
    const contentNums = new Set<number>();
    for (const o of objects) {
      if (!/\/Type\s*\/Page(?!s)/.test(o.header)) continue;
      const arr = o.header.match(/\/Contents\s*\[([^\]]*)\]/);
      if (arr) {
        for (const r of arr[1].matchAll(/(\d+)\s+0\s+R/g)) contentNums.add(Number(r[1]));
      } else {
        const single = o.header.match(/\/Contents\s+(\d+)\s+0\s+R/);
        if (single) contentNums.add(Number(single[1]));
      }
    }
    const pool = contentNums.size > 0 ? objects.filter((o) => contentNums.has(o.num)) : objects;
    const contents = pool
      .map((o) => o.text)
      .filter((t): t is string => !!t && (t.includes("BT") || /\bTj\b|\bTJ\b/.test(t)));
    const lines: string[] = [];
    let total = 0;
    if (contents.length > 0) {
      const fonts = buildFontMaps(objects);
      for (const content of contents) {
        for (const line of decodeContentText(content, fonts)) {
          lines.push(line);
          total += line.length + 1;
          if (total > 20_000) break;
        }
        if (total > 20_000) break;
      }
      const text = lines.join("\n").slice(0, 20_000);
      if (text.trim().length >= 50) return text;
      // Too little — fall through to the font-blind whole-file scan.
    }
    // No content streams (or nothing decodable): same linear decoder over
    // the whole file, keeping runs that look like words.
    const parts = decodeContentText(latin, new Map()).filter((l) => /[a-zA-Z]{3,}/.test(l));
    return parts.join("\n").slice(0, 20_000);
  } catch {
    return "";
  }
}

export async function tryWorker(
  buffer: Buffer,
  mimetype: string,
  originalname: string,
): Promise<OcrExtractOutput | null> {
  const url = getEnv().OCR_WORKER_URL?.trim();
  if (!url) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buffer)], { type: mimetype }), originalname);
    const res = await fetch(url, { method: "POST", body: form, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      text?: string;
      rawText?: string;
      confidence?: number;
      engine?: string;
    };
    const rawText = String(data.rawText ?? data.text ?? "").slice(0, 20_000);
    if (!rawText) return null;
    return {
      rawText,
      confidence: typeof data.confidence === "number" ? data.confidence : 0.7,
      engine: String(data.engine ?? "ocr-worker"),
      subjects: extractRatedSubjectsFromText(rawText),
    };
  } catch (e) {
    logger.warn({ err: e }, "[sf10-ocr] worker failed, falling back to local extract");
    return null;
  }
}

export function isXlsxUpload(mimetype: string, originalname: string): boolean {
  if (mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return true;
  return originalname.toLowerCase().endsWith(".xlsx");
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    const cell = value as { text?: unknown; result?: unknown; richText?: Array<{ text?: unknown }> };
    if (typeof cell.text === "string") return cell.text;
    if (typeof cell.result === "string" || typeof cell.result === "number") return String(cell.result);
    if (Array.isArray(cell.richText)) return cell.richText.map((r) => String(r.text ?? "")).join("");
  }
  return "";
}

/**
 * Direct cell value for formula evaluation: numbers/strings as-is, cached
 * formula results when present, else blank. Uncached formulas are resolved
 * separately against the finished row.
 */
function cellDirectValue(value: unknown): number | string | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return null;
  if (value instanceof Date) return null;
  if (typeof value === "object") {
    const cell = value as {
      text?: unknown;
      result?: unknown;
      richText?: Array<{ text?: unknown }>;
      formula?: unknown;
    };
    if (typeof cell.result === "string") return cell.result;
    if (typeof cell.result === "number") return Number.isFinite(cell.result) ? cell.result : null;
    if (typeof cell.text === "string") return cell.text;
    if (Array.isArray(cell.richText)) {
      return cell.richText.map((r) => String(r.text ?? "")).join("");
    }
  }
  return null;
}

/** True when the cell holds a formula with no cached result to read. */
function isUncachedFormula(value: unknown): value is { formula: string } {
  if (typeof value !== "object" || value === null) return false;
  const cell = value as { formula?: unknown; result?: unknown; sharedFormula?: unknown };
  return (
    typeof cell.formula === "string" &&
    cell.formula.length > 0 &&
    !(typeof cell.result === "string" || typeof cell.result === "number") &&
    cell.sharedFormula === undefined
  );
}

interface QuarterColumns {
  q: Array<[number, number]>;
  final: [number, number];
}

/**
 * Find the quarterly header row: cells exactly "1","2","3","4" in order
 * followed by a FINAL RATING cell. Returns column ranges so merged-cell
 * repetition cannot misalign quarterlies.
 */
function detectQuarterHeader(row: string[]): QuarterColumns | null {
  const at = (i: number) => (row[i] ?? "").trim();
  const ones: number[] = [];
  for (let i = 0; i < row.length && ones.length < 4; i++) {
    if (at(i) === String(ones.length + 1)) ones.push(i);
  }
  if (ones.length < 4) return null;
  let finalIdx = -1;
  for (let i = ones[3] + 1; i < row.length; i++) {
    if (/final/i.test(at(i))) {
      finalIdx = i;
      break;
    }
  }
  if (finalIdx < 0) return null;
  let remarksIdx = row.length;
  for (let i = finalIdx + 1; i < row.length; i++) {
    if (/remark/i.test(at(i))) {
      remarksIdx = i;
      break;
    }
  }
  return {
    q: [
      [ones[0], ones[1]],
      [ones[1], ones[2]],
      [ones[2], ones[3]],
      [ones[3], finalIdx],
    ],
    final: [finalIdx, remarksIdx],
  };
}

/** First 0–100 number in a cell span, else null. */
function firstNumberIn(cells: string[]): number | null {
  for (const cell of cells) {
    for (const token of cell.split(/\s+/)) {
      const v = parseRating(token);
      if (v !== null) return v;
    }
  }
  return null;
}

/** Raw cell grid across all sheets (XLSX). Empty grid on failure. */
export async function extractXlsxGrid(buffer: Buffer): Promise<string[][]> {
  try {
    const imported = (await import("exceljs")) as unknown as typeof import("exceljs") & {
      default?: typeof import("exceljs");
    };
    const ExcelJS = imported.default ?? imported;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const grid: string[][] = [];
    for (const ws of wb.worksheets) {
      ws.eachRow((row) => {
        const raw = (Array.isArray(row.values) ? row.values : []) as unknown[];
        // First pass: direct values (cached formula results included).
        const direct: Array<number | string | null> = raw.map(cellDirectValue);
        // Resolve a column, evaluating uncached same-row formulas on demand
        // (FINAL RATING and REMARKS are often computed but saved without
        // cached results — Excel shows them while the file stores nothing).
        // Formulas may chain (remarks read the final cell): memoize with a
        // cycle guard so loops fall back to blank, never hang.
        const resolving = new Set<number>();
        const resolve = (i: number): number | string | null => {
          const d = i < direct.length ? direct[i] : null;
          if (d !== null && d !== undefined) return d;
          if (resolving.has(i) || i >= raw.length) return null;
          if (!isUncachedFormula(raw[i])) return null;
          resolving.add(i);
          let out: number | string | null = null;
          try {
            const evaluated = evaluateFormula(
              (raw[i] as { formula: string }).formula,
              row.number,
              new Proxy(direct, {
                get(t, prop) {
                  if (typeof prop === "string" && /^\d+$/.test(prop)) {
                    return resolve(Number(prop));
                  }
                  return Reflect.get(t, prop);
                },
              }),
            );
            if (typeof evaluated === "number") out = evaluated;
            else if (typeof evaluated === "string" && evaluated) out = evaluated;
          } finally {
            resolving.delete(i);
          }
          direct[i] = out;
          return out;
        };
        // Second pass: every cell through the resolver.
        const texts: string[] = [];
        for (let i = 0; i < raw.length; i++) {
          const v = resolve(i);
          texts.push(v === null ? cellText(raw[i]) : typeof v === "number" ? String(v) : v);
        }
        if (texts.some((t) => t.trim())) grid.push(texts.map((t) => t.trim()));
        if (grid.length >= 400) return;
      });
      if (grid.length >= 400) break;
    }
    return grid.slice(0, 400);
  } catch (e) {
    logger.warn({ err: e }, "[sf10-ocr] xlsx grid parse failed");
    return [];
  }
}

/** Pure grid scan: grade-section tracking + per-row rating (shared by the
 *  buffer loader below and callers that already hold a grid). */
export function extractSubjectsFromGrid(grid: string[][]): RatedSubjectCandidate[] {
  const found = new Map<string, RatedSubjectCandidate>();
  let currentGrade: string | null = null;
  // Column ranges from the header row (Q1–Q4 + FINAL + REMARKS). Merged
  // cells repeat every value across columns, so bare counting misaligns —
  // ranges pin each quarter to its columns instead.
  let headerCols: { q: Array<[number, number]>; final: [number, number] } | null = null;
  for (const row of grid) {
    const line = row.filter(Boolean).join(" ").trim();
    if (!line) continue;
    // "Classified as Grade: N" opens a new scholastic block — the grade
    // basis for every subject row below it. An empty 'Classified as Grade'
    // (no grade indicated) starts an untagged block: reset so rows below
    // become add-ons (gradeLevel null) instead of inheriting the previous
    // grade. Trailing numbers in names ('ICF 7') never re-tag them.
    const classified = parseClassifiedGrade(line);
    if (classified) {
      currentGrade = classified;
      continue;
    }
    if (isClassifiedGradeLine(line)) {
      currentGrade = null;
      continue;
    }
    const header = detectQuarterHeader(row);
    if (header) {
      headerCols = header;
      continue;
    }
    const headerGrade = detectGradeLevelFromText(line);
    if (headerGrade && !matchSingleSubject(line)) {
      currentGrade = headerGrade;
      continue;
    }
    // NOTE: subject rows never switch the section - trailing '7/8/9' is
    // part of the name, not a grade tag.
    const texts = row.map((t) => t ?? "");
    let hit: { rawName: string; norm: string } | null = null;
    let hitIndex = -1;
    texts.forEach((t, i) => {
      if (hit || !t) return;
      const m = matchSingleSubject(t);
      if (m) {
        // Keep the full cell text as written ("ICF 7", "TRADE DRAWING 8") -
        // trailing numbers are part of the name for add-ons (one row each).
        const full = t.trim().replace(/\s+/g, " ");
        hit = { rawName: full || m.rawName, norm: m.norm };
        hitIndex = i;
      }
    });
    let unknownName: string | null = null;
    if (!hit && !isBlockedUnknownRow(line)) {
      // Unknown learning area kept as on record (e.g. "STVE …"): the first
      // cell must be name-shaped; grades are validated below.
      const idx = texts.findIndex((t) => t && t.trim());
      if (idx >= 0) {
        const cand = texts[idx].trim().replace(/\s+/g, " ");
        const nn = looksLikeSubjectName(cand) ? normalizeSubjectName(cand) : "";
        if (nn) {
          unknownName = cand;
          hitIndex = idx;
          hit = { rawName: cand, norm: nn };
        }
      }
    }
    if (!hit) continue;
    let quarters: Array<number | null> | null = null;
    let rating: number | null = null;
    if (headerCols) {
      // Header-pinned: first number inside each quarter's column span.
      // Merged repetition cannot shift these; blanks stay null quarters.
      const inR = (a: number, b: number) => texts.slice(a, b);
      const qs = headerCols.q.map(([a, b]) => firstNumberIn(inR(a, b)));
      const fin = firstNumberIn(inR(headerCols.final[0], headerCols.final[1]));
      if (qs.some((v) => v !== null) || fin !== null) {
        quarters = qs;
        rating = fin ?? qs.filter((v): v is number => v !== null).slice(-1)[0] ?? null;
      }
    } else {
      // No header seen: numbers in row order after the subject. Exactly
      // five number-cells means a full Q1–Q4 + FINAL row (positional);
      // otherwise collapse merged repetition and split.
      const nums: number[] = [];
      for (const cell of texts.slice(hitIndex + 1)) {
        for (const token of cell.split(/\s+/)) {
          const v = parseRating(token);
          if (v !== null) {
            nums.push(v);
            break;
          }
        }
      }
      if (nums.length === 5) {
        quarters = [nums[0], nums[1], nums[2], nums[3]];
        rating = nums[4];
      } else {
        const collapsed = nums.filter((v, i) => i === 0 || v !== nums[i - 1]);
        const split = splitQuartersFinal(collapsed);
        quarters = split.quarters;
        rating = split.final;
      }
    }
    const key = `${currentGrade ?? "?"}|${(hit as { norm: string }).norm}|${((hit as unknown as { rawName: string }).rawName || "").toUpperCase()}`;
    const existing = found.get(key);
    if (unknownName) {
      // Unknown rows need real quarterly grades, not a lone number.
      const qCount = (quarters ?? []).filter((q): q is number => typeof q === "number").length;
      if (rating === null || qCount < 3) continue;
    }
    const candidate: RatedSubjectCandidate = {
      rawName: (hit as { rawName: string }).rawName,
      norm: (hit as { norm: string }).norm,
      rating,
      gradeLevel: currentGrade,
      quarters,
      remarks: extractRemark(line),
    };
    if (!existing || (existing.rating == null && rating != null)) found.set(key, candidate);
  }
  return [...found.values()];
}

/**
 * Detect an SHS SF10 workbook (DepEd SF10-SHS) by its title block. JHS
 * workbooks never contain these markers.
 */
export function isShsForm(grid: string[][]): boolean {
  const flat = grid.map((r) => r.join(" ")).join(" ").toLowerCase();
  return /sf\s*10\s*[-–]?\s*shs|senior high school student permanent/i.test(flat);
}

/**
 * SHS XLSX extraction: subjects are grouped under CORE / APPLIED /
 * SPECIALIZED, one row per subject, with a semestral final grade (average of
 * two quarterly grades). Grade level comes from the "GRADE LEVEL:" row.
 */
export function extractSubjectsFromGridShs(grid: string[][]): RatedSubjectCandidate[] {
  const found = new Map<string, RatedSubjectCandidate>();
  let currentGrade: string | null = null;
  let currentSem: "1ST" | "2ND" = "1ST";
  for (const row of grid) {
    const cells = row.map((c) => (c ?? "").trim());
    const line = cells.filter(Boolean).join(" ");
    if (!line) continue;

    // Track the grade level for this scholastic block.
    if (cells.some((c) => /grade\s*level/i.test(c))) {
      for (const c of cells) {
        const m = c.match(/^(?:g\s*)?(7|8|9|10|11|12)$/i);
        if (m) {
          currentGrade = `G${m[1]}`;
          break;
        }
      }
      const sem = cells.find((c) => /^(1ST|2ND)$/i.test(c.trim()));
      if (sem) currentSem = sem.trim().toUpperCase() as "1ST" | "2ND";
    }

    // Header row — skip.
    if (cells.some((c) => /^subjects?$/i.test(c)) && cells.some((c) => /sem\s*final\s*grade/i.test(c))) {
      continue;
    }
    if (/general ave|remarks:|prepared by|certified true/i.test(line)) continue;

    // A subject row carries a category in its leading cells.
    const category = cells.slice(1, 9).find((c) => /^(core|applied|specialized)$/i.test(c));
    if (!category) continue;

    const subjectName = cells[9];
    if (!subjectName || !/[a-zA-Z]{2,}/.test(subjectName)) continue;
    if (isNonSubjectRow(subjectName) || isBlockedUnknownRow(subjectName)) continue;

    // Quarter grades: two quarters (5 cells each, merged) at 46-50 and 51-55;
    // sem final grade at 56-60 (5 merged cells).
    const quarterVals: Array<number | null> = [];
    for (let i = 46; i <= 50; i++) quarterVals.push(parseRating(cells[i]));
    const q2: Array<number | null> = [];
    for (let i = 51; i <= 55; i++) q2.push(parseRating(cells[i]));
    let semFinal: number | null = null;
    for (let i = 56; i <= 60; i++) {
      const v = parseRating(cells[i]);
      if (v !== null) {
        semFinal = v;
        break;
      }
    }
    if (semFinal === null) {
      const nums = cells.slice(46).map(parseRating).filter((v): v is number => v !== null);
      if (nums.length > 0) semFinal = nums[nums.length - 1];
    }
    if (semFinal === null) continue;

    const q1 = quarterVals.find((v) => v !== null) ?? null;
    const q2v = q2.find((v) => v !== null) ?? null;
    const isSecondSem = currentSem === "2ND";
    const semIdx = isSecondSem ? 1 : 0;
    const slot0 = isSecondSem ? 2 : 0;
    const slot1 = isSecondSem ? 3 : 1;
    const quarters =
      q1 !== null || q2v !== null
        ? (() => {
            const arr: Array<number | null> = [null, null, null, null];
            if (q1 !== null) arr[slot0] = q1;
            if (q2v !== null) arr[slot1] = q2v;
            return arr;
          })()
        : null;
    const rawName = subjectName.trim().replace(/\s+/g, " ");
    const norm = normalizeSubjectName(rawName);
    if (!norm) continue;

    const key = `${currentGrade ?? "?"}|${norm}`;
    const existing = found.get(key);
    const newQuarters = quarters ?? [];
    if (existing) {
      // Merge across semester blocks: append this semester's quarterly grades
      // to the existing ones so S1..S4 all survive (SHS has 4 quarters).
      const merged: Array<number | null> = [...(existing.quarters ?? [null, null, null, null])];
      while (merged.length < 4) merged.push(null);
      for (let i = 0; i < 4; i++) {
        if (newQuarters[i] !== null && newQuarters[i] !== undefined) {
          merged[i] = newQuarters[i] as number;
        }
      }
      const rating = semFinal != null ? semFinal : existing.rating;
      const mergedSemFinals = [...(existing.semFinals ?? [null, null])];
      mergedSemFinals[semIdx] = semFinal ?? mergedSemFinals[semIdx] ?? null;
      found.set(key, {
        ...existing,
        rating,
        quarters: merged.length > 0 ? merged : existing.quarters,
        semFinals: mergedSemFinals,
        remarks: extractRemark(line) ?? existing.remarks,
      });
    } else {
      const semFinals: Array<number | null> = [null, null];
      semFinals[semIdx] = semFinal;
      const candidate: RatedSubjectCandidate = {
        rawName,
        norm,
        rating: semFinal,
        gradeLevel: currentGrade,
        quarters: newQuarters.length > 0 ? newQuarters : null,
        semFinals,
        remarks: extractRemark(line),
      };
      found.set(key, candidate);
    }
  }
  return [...found.values()];
}

/** Structured XLSX read: grade-section tracking + per-row rating, no OCR. */
export async function extractXlsxSubjects(buffer: Buffer): Promise<RatedSubjectCandidate[]> {
  try {
    return extractSubjectsFromGrid(await extractXlsxGrid(buffer));
  } catch (e) {
    logger.warn({ err: e }, "[sf10-ocr] xlsx subject parse failed");
    return [];
  }
}

export async function extractXlsxText(buffer: Buffer): Promise<string> {
  try {
    const imported = (await import("exceljs")) as unknown as typeof import("exceljs") & {
      default?: typeof import("exceljs");
    };
    const ExcelJS = imported.default ?? imported;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const parts: string[] = [];
    wb.eachSheet((ws) => {
      ws.eachRow((row) => {
        const values = Array.isArray(row.values) ? row.values : [];
        for (const v of values) {
          if (v == null) continue;
          let text = "";
          if (typeof v === "string" || typeof v === "number") text = String(v);
          else if (typeof v === "object") {
            const cell = v as { text?: unknown; result?: unknown; richText?: Array<{ text?: unknown }> };
            if (typeof cell.text === "string") text = cell.text;
            else if (typeof cell.result === "string" || typeof cell.result === "number") text = String(cell.result);
            else if (Array.isArray(cell.richText)) {
              text = cell.richText.map((r) => String(r.text ?? "")).join("");
            }
          }
          if (text.trim()) parts.push(text.trim());
          if (parts.join("\n").length > 20_000) break;
        }
      });
    });
    return parts.join("\n").slice(0, 20_000);
  } catch (e) {
    logger.warn({ err: e }, "[sf10-ocr] xlsx parse failed");
    return "";
  }
}
