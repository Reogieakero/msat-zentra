/**
 * Minimal, dependency-free PDF text-position reader.
 *
 * Why: the SF10 auto-fill must patch the registrar's uploaded PDF instead of
 * rebuilding it, so it needs the device-space position of every text run. PDF
 * text lives in Flate-compressed content streams; pdf-lib can draw but cannot
 * read text. This module inflates the streams, decodes the fonts through their
 * ToUnicode CMaps and returns positioned runs. It understands the operators
 * Google Sheets / Excel / Word exports emit (text matrices, Tj/TJ, q/cm) and
 * silently ignores everything else. Scanned PDFs have no text layer and yield
 * no runs — callers must keep a fallback for those.
 */

import { deflateSync, inflateSync } from "node:zlib";

export interface PdfTextRun {
  /** 1-based page number in document order. */
  page: number;
  text: string;
  /** Device-space x of the run start (points, origin bottom-left). */
  x: number;
  /** Device-space baseline y (points, origin bottom-left). */
  y: number;
  /** Device-space font size. */
  size: number;
  /** Object id of the content stream this run was drawn from. */
  streamId: number;
  /** Char offsets of the string operand inside that (inflated) stream. */
  start: number;
  end: number;
}

interface PdfObject {
  dict: string;
  stream: Buffer | null;
}

type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}

function apply(m: Matrix, x: number, y: number): { x: number; y: number } {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

function parseObjects(buf: Buffer): Map<number, PdfObject> {
  const latin = buf.toString("latin1");
  const objs = new Map<number, PdfObject>();
  const re = /(\d+)\s+0\s+obj\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(latin)) !== null) {
    const id = Number(m[1]);
    const bodyStart = m.index + m[0].length;
    const end = latin.indexOf("endobj", bodyStart);
    if (end < 0) continue;
    const body = latin.slice(bodyStart, end);
    const streamAt = body.search(/\bstream\r?\n/);
    if (streamAt < 0) {
      objs.set(id, { dict: body, stream: null });
      continue;
    }
    const dict = body.slice(0, streamAt);
    const dataStart = bodyStart + streamAt + body.slice(streamAt).match(/^\bstream\r?\n/)![0].length;
    const len = /\/Length\s+(\d+)/.exec(dict);
    const lengthIsReference = /\/Length\s+\d+\s+0\s+R/.test(dict);
    const dataEnd =
      len && !lengthIsReference
        ? dataStart + Number(len[1])
        : latin.indexOf("endstream", dataStart);
    let raw = buf.subarray(dataStart, Math.max(dataStart, dataEnd));
    let data: Buffer | null = raw;
    if (/\/FlateDecode/.test(dict)) {
      try {
        data = inflateSync(raw);
      } catch {
        try {
          data = inflateSync(raw, { finishFlush: 2 /* Z_SYNC_FLUSH */ });
        } catch {
          data = null;
        }
      }
    } else if (/\/Filter/.test(dict)) {
      // Unsupported filters (LZW, ASCII85+image, ...) — not text content.
      data = null;
    }
    objs.set(id, { dict, stream: data });
    raw = Buffer.alloc(0);
  }
  expandObjectStreams(objs);
  return objs;
}

/**
 * pdf-lib (and many modern producers) pack page/font dictionaries into
 * compressed `/Type /ObjStm` streams. Unpack them so object lookups work the
 * same for the uploaded file and for a re-saved patched copy.
 */
function expandObjectStreams(objs: Map<number, PdfObject>): void {
  const seen = new Set<number>();
  let added = true;
  while (added) {
    added = false;
    for (const [id, obj] of [...objs.entries()]) {
      if (seen.has(id)) continue;
      seen.add(id);
      if (!/\/Type\s*\/ObjStm\b/.test(obj.dict) || !obj.stream) continue;
      const count = Number(/\/N\s+(\d+)/.exec(obj.dict)?.[1] ?? 0);
      const first = Number(/\/First\s+(\d+)/.exec(obj.dict)?.[1] ?? 0);
      if (!count || !first) continue;
      const data = obj.stream.toString("latin1");
      const head = data.slice(0, first).trim().split(/\s+/).map(Number);
      const pairs: Array<{ id: number; offset: number }> = [];
      for (let i = 0; i + 1 < head.length; i += 2) {
        pairs.push({ id: head[i], offset: head[i + 1] });
      }
      pairs.forEach((pair, i) => {
        if (objs.has(pair.id)) return;
        const start = first + pair.offset;
        const end = i + 1 < pairs.length ? first + pairs[i + 1].offset : data.length;
        objs.set(pair.id, { dict: data.slice(start, end), stream: null });
        added = true;
      });
    }
  }
}

function refId(dict: string, key: string): number | null {
  const m = new RegExp(`/${key}\\s+(\\d+)\\s+0\\s+R`).exec(dict);
  return m ? Number(m[1]) : null;
}

function allRefIds(dict: string, key: string): number[] {
  const m = new RegExp(`/${key}\\s*\\[([^\\]]*)\\]`).exec(dict);
  if (m) {
    return [...m[1].matchAll(/(\d+)\s+0\s+R/g)].map((x) => Number(x[1]));
  }
  const single = refId(dict, key);
  return single != null ? [single] : [];
}

/* ---------------------------- font decoding ---------------------------- */

type Decoder = (bytes: Buffer) => string;

function utf16be(hex: string): string {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  let out = "";
  for (let i = 0; i + 3 < clean.length; i += 4) {
    out += String.fromCharCode(parseInt(clean.slice(i, i + 4), 16));
  }
  return out;
}

function parseToUnicode(cmap: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      map.set(parseInt(pair[1], 16), utf16be(pair[2]));
    }
  }
  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    const body = block[1];
    for (const r of body.matchAll(
      /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]+)>|\[([\s\S]*?)\])/g,
    )) {
      const lo = parseInt(r[1], 16);
      const hi = parseInt(r[2], 16);
      if (r[3]) {
        const start = parseInt(r[3], 16);
        for (let code = lo; code <= hi; code += 1) {
          map.set(code, String.fromCharCode(start + (code - lo)));
        }
      } else if (r[4]) {
        const items = [...r[4].matchAll(/<([0-9a-fA-F]+)>/g)].map((x) => x[1]);
        items.forEach((hex, i) => {
          if (lo + i <= hi) map.set(lo + i, utf16be(hex));
        });
      }
    }
  }
  return map;
}

/** WinAnsi is close enough to latin1 for the punctuation SF10 forms use. */
function latinDecoder(bytes: Buffer): string {
  return bytes.toString("latin1");
}

function fontDecoder(objs: Map<number, PdfObject>, fontId: number | null): Decoder {
  if (fontId == null) return latinDecoder;
  const font = objs.get(fontId);
  if (!font) return latinDecoder;
  const subtype = /\/Subtype\s*\/(\w+)/.exec(font.dict)?.[1] ?? "";
  const toUniId = refId(font.dict, "ToUnicode");
  const cmap = toUniId != null ? objs.get(toUniId)?.stream?.toString("latin1") : null;
  const map = cmap ? parseToUnicode(cmap) : null;
  if (subtype === "Type0" || map) {
    const table = map;
    return (bytes) => {
      let out = "";
      for (let i = 0; i + 1 < bytes.length; i += 2) {
        const code = (bytes[i] << 8) | bytes[i + 1];
        out += table?.get(code) ?? "";
      }
      return out;
    };
  }
  return latinDecoder;
}

/* --------------------------- content tokenizer --------------------------- */

type Token =
  | { t: "num"; v: number }
  /** `start`/`end` are char offsets in the source stream (used for stripping). */
  | { t: "str"; v: Buffer; start: number; end: number }
  | { t: "name"; v: string }
  | { t: "arr"; v: Token[] }
  | { t: "op"; v: string };

function readLiteralString(src: string, start: number): { bytes: Buffer; end: number } {
  let i = start + 1;
  let depth = 1;
  const out: number[] = [];
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === "\\") {
      const next = src[i + 1];
      const escapes: Record<string, number> = {
        n: 10,
        r: 13,
        t: 9,
        b: 8,
        f: 12,
        "(": 40,
        ")": 41,
        "\\": 92,
      };
      if (next in escapes) {
        out.push(escapes[next]);
        i += 2;
      } else if (next === "\n") {
        i += 2;
      } else if (next === "\r") {
        i += src[i + 2] === "\n" ? 3 : 2;
      } else if (/[0-7]/.test(next ?? "")) {
        let oct = "";
        let k = 1;
        while (k <= 3 && /[0-7]/.test(src[i + k] ?? "")) {
          oct += src[i + k];
          k += 1;
        }
        out.push(parseInt(oct, 8) & 0xff);
        i += k;
      } else {
        out.push(next.charCodeAt(0));
        i += 2;
      }
      continue;
    }
    if (ch === "(") depth += 1;
    if (ch === ")") {
      depth -= 1;
      if (depth === 0) {
        i += 1;
        break;
      }
    }
    out.push(ch.charCodeAt(0) & 0xff);
    i += 1;
  }
  return { bytes: Buffer.from(out), end: i };
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "%") {
      const nl = src.indexOf("\n", i);
      i = nl < 0 ? src.length : nl + 1;
      continue;
    }
    if (ch === "(") {
      const start = i;
      const { bytes, end } = readLiteralString(src, i);
      tokens.push({ t: "str", v: bytes, start, end });
      i = end;
      continue;
    }
    if (ch === "<") {
      if (src[i + 1] === "<") {
        // Inline dict (e.g. BDC properties) — skip to the matching >>.
        let depth = 0;
        let k = i;
        for (; k < src.length; k += 1) {
          if (src[k] === "<" && src[k + 1] === "<") {
            depth += 1;
            k += 1;
          } else if (src[k] === ">" && src[k + 1] === ">") {
            depth -= 1;
            k += 1;
            if (depth === 0) break;
          }
        }
        i = k + 1;
        continue;
      }
      const close = src.indexOf(">", i);
      if (close < 0) break;
      const hex = src.slice(i + 1, close).replace(/\s+/g, "");
      const bytes: number[] = [];
      for (let k = 0; k + 1 < hex.length; k += 2) {
        bytes.push(parseInt(hex.slice(k, k + 2), 16));
      }
      tokens.push({ t: "str", v: Buffer.from(bytes), start: i, end: close + 1 });
      i = close + 1;
      continue;
    }
    if (ch === "[" || ch === "]") {
      tokens.push({ t: "op", v: ch });
      i += 1;
      continue;
    }
    if (ch === "/") {
      let k = i + 1;
      while (k < src.length && !/[\s\/\[\]<>()]/.test(src[k])) k += 1;
      tokens.push({ t: "name", v: src.slice(i + 1, k) });
      i = k;
      continue;
    }
    if (/[+-.\d]/.test(ch)) {
      let k = i;
      while (k < src.length && /[+-.\d]/.test(src[k])) k += 1;
      const n = Number(src.slice(i, k));
      if (Number.isFinite(n)) tokens.push({ t: "num", v: n });
      i = k;
      continue;
    }
    let k = i;
    while (k < src.length && !/[\s\/\[\]<>()]/.test(src[k])) k += 1;
    const word = src.slice(i, k);
    i = k;
    if (word) tokens.push({ t: "op", v: word });
  }
  return tokens;
}

/* --------------------------- page text extraction --------------------------- */

interface FontState {
  name: string;
  size: number;
}

interface ContentPart {
  id: number;
  text: string;
}

function collectContentStreams(
  objs: Map<number, PdfObject>,
  pageObj: PdfObject,
): ContentPart[] {
  const ids = allRefIds(pageObj.dict, "Contents");
  const parts: ContentPart[] = [];
  for (const id of ids) {
    const s = objs.get(id)?.stream;
    if (s) parts.push({ id, text: s.toString("latin1") });
  }
  return parts;
}

function pageFonts(
  objs: Map<number, PdfObject>,
  pageObj: PdfObject,
): Map<string, Decoder> {
  const fonts = new Map<string, Decoder>();
  let resources: PdfObject | undefined = pageObj;
  const resRef = refId(pageObj.dict, "Resources");
  if (resRef != null) resources = objs.get(resRef);
  const resDict = resources?.dict ?? "";
  const inlineFonts = /\/Font\s*<<([\s\S]*?)>>/.exec(resDict)?.[1];
  const fontDict =
    inlineFonts ??
    (() => {
      const fontRef = refId(resDict, "Font");
      return fontRef != null ? objs.get(fontRef)?.dict ?? "" : "";
    })();
  for (const m of fontDict.matchAll(/\/([A-Za-z0-9_.+-]+)\s+(\d+)\s+0\s+R/g)) {
    fonts.set(m[1], fontDecoder(objs, Number(m[2])));
  }
  return fonts;
}

export function extractPdfTextRuns(buffer: Buffer): PdfTextRun[] {
  if (!buffer.subarray(0, 5).toString("latin1").startsWith("%PDF")) return [];
  const objs = parseObjects(buffer);
  const runs: PdfTextRun[] = [];
  const pages = [...objs.entries()]
    .filter(([, o]) => /\/Type\s*\/Page\b/.test(o.dict) && !/\/Type\s*\/Pages\b/.test(o.dict))
    .sort((a, b) => a[0] - b[0]);

  pages.forEach(([, pageObj], pageIndex) => {
    const parts = collectContentStreams(objs, pageObj);
    if (parts.length === 0) return;
    const fonts = pageFonts(objs, pageObj);

    let ctm: Matrix = [...IDENTITY];
    const stack: Matrix[] = [];
    let tm: Matrix = [...IDENTITY];
    let tlm: Matrix = [...IDENTITY];
    let fontName = "";
    let fontSize = 0;
    let leading = 0;
    let operands: Token[] = [];
    let arrayStack: Token[][] = [];
    let streamId = parts[0].id;

    const pushArray = () => arrayStack.push([]);
    const popArray = () => {
      const arr = arrayStack.pop() ?? [];
      operands.push({ t: "arr", v: arr });
    };

    const show = (token: Extract<Token, { t: "str" }>) => {
      const bytes = token.v;
      const decoder = fonts.get(fontName) ?? latinDecoder;
      const text = decoder(bytes);
      if (!text.trim()) {
        // Still advances the text position, roughly.
        tm = multiply([1, 0, 0, 1, bytes.length * 0.5 * fontSize, 0], tm);
        return;
      }
      const pos = apply(multiply(tm, ctm), 0, 0);
      const deviceSize = Math.hypot(
        (apply(multiply(tm, ctm), 0, fontSize).y ?? 0) - pos.y,
        (apply(multiply(tm, ctm), 0, fontSize).x ?? 0) - pos.x,
      );
      runs.push({
        page: pageIndex + 1,
        text,
        x: pos.x,
        y: pos.y,
        size: deviceSize || fontSize,
        streamId,
        start: token.start,
        end: token.end,
      });
      tm = multiply([1, 0, 0, 1, text.length * 0.5 * fontSize, 0], tm);
    };

    for (const part of parts) {
      streamId = part.id;
      operands = [];
      arrayStack = [];
      const tokens = tokenize(part.text);

      for (const token of tokens) {
        if (token.t !== "op") {
          if (arrayStack.length > 0) arrayStack[arrayStack.length - 1].push(token);
          else operands.push(token);
          continue;
        }
        const op = token.v;
        if (op === "[") {
          pushArray();
          continue;
        }
        if (op === "]") {
          popArray();
          continue;
        }
        if (arrayStack.length > 0) {
          arrayStack[arrayStack.length - 1].push(token);
          continue;
        }

        const nums = operands.filter((o) => o.t === "num").map((o) => (o as { v: number }).v);
        switch (op) {
          case "q":
            stack.push([...ctm]);
            break;
          case "Q":
            ctm = stack.pop() ?? [...IDENTITY];
            break;
          case "cm":
            if (nums.length >= 6) {
              const n = nums.slice(-6) as Matrix;
              ctm = multiply(n, ctm);
            }
            break;
          case "BT":
            tm = [...IDENTITY];
            tlm = [...IDENTITY];
            break;
          case "Tf": {
            const name = operands.find((o) => o.t === "name");
            if (name) fontName = (name as { v: string }).v;
            if (nums.length > 0) fontSize = nums[nums.length - 1];
            break;
          }
          case "Tm":
            if (nums.length >= 6) {
              tm = nums.slice(-6) as Matrix;
              tlm = [...tm];
            }
            break;
          case "Td":
            if (nums.length >= 2) {
              tlm = multiply([1, 0, 0, 1, nums[nums.length - 2], nums[nums.length - 1]], tlm);
              tm = [...tlm];
            }
            break;
          case "TD":
            if (nums.length >= 2) {
              leading = -nums[nums.length - 1];
              tlm = multiply([1, 0, 0, 1, nums[nums.length - 2], nums[nums.length - 1]], tlm);
              tm = [...tlm];
            }
            break;
          case "TL":
            if (nums.length > 0) leading = nums[nums.length - 1];
            break;
          case "T*":
            tlm = multiply([1, 0, 0, 1, 0, -leading], tlm);
            tm = [...tlm];
            break;
          case "Tj": {
            const s = operands.find((o) => o.t === "str") as
              | Extract<Token, { t: "str" }>
              | undefined;
            if (s) show(s);
            break;
          }
          case "'": {
            tlm = multiply([1, 0, 0, 1, 0, -leading], tlm);
            tm = [...tlm];
            const s = operands.find((o) => o.t === "str") as
              | Extract<Token, { t: "str" }>
              | undefined;
            if (s) show(s);
            break;
          }
          case '"': {
            tlm = multiply([1, 0, 0, 1, 0, -leading], tlm);
            tm = [...tlm];
            const s = operands.find((o) => o.t === "str") as
              | Extract<Token, { t: "str" }>
              | undefined;
            if (s) show(s);
            break;
          }
          case "TJ": {
            const arr = operands.find((o) => o.t === "arr") as { v: Token[] } | undefined;
            if (arr) {
              for (const item of arr.v) {
                if (item.t === "str") show(item);
                else if (item.t === "num") {
                  tm = multiply([1, 0, 0, 1, (-item.v / 1000) * fontSize, 0], tm);
                }
              }
            }
            break;
          }
          default:
            break;
        }
        operands = [];
      }
    }
  });

  return runs;
}

/** Group runs into visual lines (top→bottom, left→right). */
export interface PdfLine {
  page: number;
  y: number;
  runs: PdfTextRun[];
  text: string;
}

export function groupPdfLines(runs: PdfTextRun[]): PdfLine[] {
  const byPage = new Map<number, PdfTextRun[]>();
  for (const run of runs) {
    const list = byPage.get(run.page) ?? [];
    list.push(run);
    byPage.set(run.page, list);
  }
  const lines: PdfLine[] = [];
  for (const [page, list] of [...byPage.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = [...list].sort((a, b) => b.y - a.y || a.x - b.x);
    let current: PdfTextRun[] = [];
    let currentY = Number.NaN;
    const flush = () => {
      if (current.length === 0) return;
      const ordered = [...current].sort((a, b) => a.x - b.x);
      lines.push({ page, y: currentY, runs: ordered, text: ordered.map((r) => r.text).join(" ") });
    };
    for (const run of sorted) {
      if (current.length === 0 || Math.abs(run.y - currentY) <= 2.5) {
        if (current.length === 0) currentY = run.y;
        current.push(run);
        continue;
      }
      flush();
      current = [run];
      currentY = run.y;
    }
    flush();
  }
  return lines;
}

/**
 * Produce a NEW PDF document with the given string operands removed from the
 * content streams. Spans are char offsets inside the inflated stream named by
 * the object id (see `PdfTextRun.streamId/start/end`), so callers can delete
 * exactly the old grade glyphs before drawing the auto-filled values. The
 * returned buffer is a fresh document — the input buffer is never mutated.
 */
export async function stripPdfTextSpans(
  buffer: Buffer,
  spans: Map<number, Array<{ start: number; end: number }>>,
): Promise<Buffer | null> {
  if (spans.size === 0) return null;
  const objs = parseObjects(buffer);
  const { PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef } = await import(
    "pdf-lib"
  );
  const doc = await PDFDocument.load(buffer);
  let changed = 0;

  for (const [id, ranges] of spans) {
    const source = objs.get(id)?.stream;
    if (!source) continue;
    let text = source.toString("latin1");
    const sorted = [...ranges].sort((a, b) => b.start - a.start);
    for (const range of sorted) {
      if (range.start < 0 || range.end > text.length || range.end <= range.start) continue;
      text = text.slice(0, range.start) + text.slice(range.end);
    }
    const compressed = deflateSync(Buffer.from(text, "latin1"));
    const ref = PDFRef.of(id, 0);
    const candidate = doc.context.lookup(ref);
    const existing = candidate instanceof PDFRawStream ? candidate : null;
    const dict = existing ? existing.dict.clone(doc.context) : PDFDict.withContext(doc.context);
    dict.set(PDFName.of("Filter"), PDFName.of("FlateDecode"));
    dict.delete(PDFName.of("DecodeParms"));
    dict.set(PDFName.of("Length"), PDFNumber.of(compressed.length));
    doc.context.assign(ref, PDFRawStream.of(dict, compressed));
    changed += 1;
  }

  if (changed === 0) return null;
  return Buffer.from(await doc.save());
}
