import type { OcrSubjectPayload } from "./records.service.js";
import { detectQuarterHeader, isXlsxUpload } from "./ocr-text.service.js";
import { extractPdfTextRuns, groupPdfLines, stripPdfTextSpans, type PdfLine } from "./pdf-text.service.js";
import {
  detectGradeLevelFromText,
  isClassifiedGradeLine,
  matchSingleSubject,
  parseClassifiedGrade,
} from "./subject-aliases.js";

type ExcelJSModule = typeof import("exceljs");
type Worksheet = import("exceljs").Worksheet;

const GRADE_ORDER = ["G7", "G8", "G9", "G10", "G11", "G12"];
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PDF_MIME = "application/pdf";

export interface GeneratedSf10Input {
  learnerName: string;
  lrn: string;
  gradeLevel: string;
  schoolYear?: string | null;
  subjects: OcrSubjectPayload[];
  generatedAt?: Date;
}

/** One row just written by auto-fill — the only cells a patched copy touches. */
export interface AutoFillPatchRow {
  norm: string;
  /** Display name, used when the subject is missing from the original form. */
  rawName?: string;
  gradeLevel: string;
  quarters?: Array<number | null> | null;
  rating?: number | null;
  remarks?: string | null;
}

export interface OriginalSf10File {
  buffer: Buffer;
  /** Lower-case extension (`pdf` / `xlsx`). */
  ext: string;
  mimeType: string;
}

export interface RenderAutoFillFileInput extends GeneratedSf10Input {
  /** The registrar/record-keeper upload this run derives from. */
  original: OriginalSf10File | null;
  /** Rows auto-fill wrote (current grade only). */
  filled: AutoFillPatchRow[];
}

export interface RenderedSf10File {
  buffer: Buffer;
  ext: "pdf" | "xlsx";
  mimeType: string;
}

async function excelJs(): Promise<ExcelJSModule> {
  const imported = (await import("exceljs")) as unknown as ExcelJSModule & {
    default?: ExcelJSModule;
  };
  return imported.default ?? imported;
}

/** Cell text without exceljs merge/formula quirk damage. */
function readCellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return "";
  if (value instanceof Date) return "";
  if (typeof value === "object") {
    const cell = value as {
      text?: unknown;
      result?: unknown;
      richText?: Array<{ text?: unknown }>;
    };
    if (typeof cell.text === "string" && cell.text !== "[object Object]") {
      return cell.text.trim();
    }
    if (typeof cell.result === "string" || typeof cell.result === "number") {
      return String(cell.result).trim();
    }
    if (Array.isArray(cell.richText)) {
      return cell.richText.map((r) => String(r.text ?? "")).join("").trim();
    }
  }
  return "";
}

function rowTexts(values: unknown[], width: number): string[] {
  const texts: string[] = [];
  for (let i = 0; i <= width; i += 1) texts.push(readCellText(values[i]));
  return texts;
}

interface SubjectSlot {
  norm: string;
  /** 1-based column that carries the subject name. */
  subjectCol: number;
  row: number;
}

interface GradeBlock {
  grade: string;
  qCols: number[];
  finalCol: number;
  remarksCol: number;
  slots: SubjectSlot[];
}

/**
 * Load the original registrar/record-keeper workbook and update only the
 * auto-filled subject rows. Every other sheet, cell, merge and format is left
 * exactly as uploaded. Subjects that never appear on the form are skipped (row
 * insertion in exceljs breaks the workbook's shared formulas and merges).
 */
export async function patchSf10Workbook(
  original: Buffer,
  filled: AutoFillPatchRow[],
): Promise<Buffer> {
  const ExcelJS = await excelJs();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(original as unknown as ArrayBuffer);

  for (const ws of wb.worksheets) {
    const width = ws.columnCount;
    const blocks: GradeBlock[] = [];
    let grade: string | null = null;
    let header: ReturnType<typeof detectQuarterHeader> = null;
    let current: GradeBlock | null = null;

    for (let r = 1; r <= ws.rowCount; r += 1) {
      const row = ws.getRow(r);
      const texts = rowTexts(row.values as unknown[], width);
      const line = texts.filter(Boolean).join(" ").trim();
      if (!line) continue;

      const classified = parseClassifiedGrade(line);
      if (classified) {
        grade = classified;
        header = null;
        current = null;
        continue;
      }
      if (isClassifiedGradeLine(line)) {
        grade = null;
        header = null;
        current = null;
        continue;
      }

      const headerCols = detectQuarterHeader(texts);
      if (headerCols) {
        header = headerCols;
        current = null;
        continue;
      }

      const headerGrade = detectGradeLevelFromText(line);
      if (headerGrade && !matchSingleSubject(line)) {
        grade = headerGrade;
        header = null;
        current = null;
        continue;
      }

      if (!grade || !header) continue;

      let subject: Omit<SubjectSlot, "row"> | null = null;
      for (let c = 1; c <= width; c += 1) {
        const text = texts[c];
        if (!text) continue;
        const hit = matchSingleSubject(text);
        if (hit) {
          subject = { norm: hit.norm, subjectCol: c };
          break;
        }
      }
      if (!subject) continue;

      if (!current) {
        current = {
          grade,
          qCols: header.q.map(([start]) => start),
          finalCol: header.final[0],
          remarksCol: header.final[1],
          slots: [],
        };
        blocks.push(current);
      }
      current.slots.push({ ...subject, row: r });
    }

    for (const block of blocks) {
      const touched = filled.filter((f) => f.gradeLevel === block.grade);
      if (touched.length === 0) continue;
      // Flatten formulas only in the rows being rewritten. The final-rating
      // and remarks columns share formulas across the block's subject rows;
      // leaving the clones as formulas after overwriting a master makes the
      // workbook unserializable. Other grade blocks keep their formulas.
      flattenRowsFormulas(ws, block.slots.map((s) => s.row), width);
      for (const f of touched) {
        const slot = block.slots.find((s) => s.norm === f.norm);
        // A subject that never appeared on the uploaded form has no cell to
        // write into. Leave the untouched sheet as-is rather than shifting
        // rows (exceljs row insert breaks the workbook's shared formulas).
        if (!slot) continue;
        writeSubjectRow(ws, slot.row, block, f);
      }
    }
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

function writeSubjectRow(
  ws: Worksheet,
  rowNumber: number,
  block: GradeBlock,
  filled: AutoFillPatchRow,
): void {
  const row = ws.getRow(rowNumber);
  const quarters = filled.quarters ?? [];
  block.qCols.forEach((col, i) => {
    writeCell(ws, rowNumber, col, quarters[i] ?? null);
  });
  writeCell(ws, rowNumber, block.finalCol, filled.rating ?? null);
  writeCell(ws, rowNumber, block.remarksCol, filled.remarks ?? null);
  row.commit();
}

/**
 * Write a value into a form cell. Merged clone cells follow the master, and
 * formulas are flattened beforehand, so a direct assignment is safe.
 */
function writeCell(ws: Worksheet, row: number, col: number, value: string | number | null): void {
  ws.getRow(row).getCell(col).value = value;
}

/**
 * Replace formula cells in the given rows with their cached results. The SF10
 * form shares final-rating/remarks formulas across a grade block's subject
 * rows; overwriting one master would orphan its clones and make the workbook
 * unserializable. Cells outside the rewritten blocks keep their live formulas.
 */
function flattenRowsFormulas(ws: Worksheet, rows: number[], width: number): void {
  for (const r of new Set(rows)) {
    const row = ws.getRow(r);
    for (let c = 1; c <= width; c += 1) {
      const cell = row.getCell(c);
      const value = cell.value;
      if (!value || typeof value !== "object" || value instanceof Date) continue;
      const obj = value as { formula?: unknown; sharedFormula?: unknown; result?: unknown };
      if (typeof obj.formula !== "string" && typeof obj.sharedFormula !== "string") continue;
      const result = obj.result;
      cell.value =
        typeof result === "number" || typeof result === "string" || typeof result === "boolean"
          ? result
          : null;
    }
  }
}

/* ----------------------------- PDF patching ----------------------------- */

interface PdfGradeBlock {
  grade: string;
  page: number;
  lines: PdfLine[];
}

function gradeFromLine(line: PdfLine): string | null {
  const m = /classified\s+as\s+grade\s*:?\s*(\d{1,2})/i.exec(line.text);
  return m ? `G${m[1]}` : null;
}

/** One `Classified as Grade: N` block per grade level, top to bottom. */
function findGradeBlocks(lines: PdfLine[]): PdfGradeBlock[] {
  const blocks: PdfGradeBlock[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const grade = gradeFromLine(lines[i]);
    if (!grade) continue;
    const body: PdfLine[] = [lines[i]];
    let j = i + 1;
    for (; j < lines.length; j += 1) {
      if (gradeFromLine(lines[j]) || /^certification$/i.test(lines[j].text.trim())) break;
      body.push(lines[j]);
    }
    blocks.push({ grade, page: lines[i].page, lines: body });
    i = j - 1;
  }
  return blocks;
}

/**
 * x anchors for the six value cells: Q1–Q4 from the "1 2 3 4" header row,
 * Final/Remarks from their header labels. Values sit a few points right of the
 * label start, so callers match with a tolerance.
 */
function columnAnchors(block: PdfGradeBlock): number[] | null {
  const runs = block.lines.flatMap((l) => l.runs);
  const quarters = runs.filter((r) => /^[1-4]$/.test(r.text.trim())).slice(0, 4);
  if (quarters.length < 4) return null;
  const finalRun = runs.find((r) => /^final$/i.test(r.text.trim()));
  const remarksRun = runs.find((r) => /^remarks$/i.test(r.text.trim()));
  if (!finalRun || !remarksRun) return null;
  return [...quarters.map((r) => r.x), finalRun.x, remarksRun.x];
}

function findSubjectLine(block: PdfGradeBlock, norm: string): PdfLine | null {
  for (const line of block.lines) {
    for (const run of line.runs) {
      const hit = matchSingleSubject(run.text);
      if (hit && hit.norm === norm) return line;
    }
  }
  return null;
}

/**
 * Build a NEW PDF document from the uploaded one: the old grade glyphs for the
 * auto-filled cells are deleted from the content streams and the new Q1–Q4 /
 * final / remarks values are drawn at the same positions. The page keeps the
 * registrar's exact layout, header, other grades and untouched rows, but there
 * is no stale value hidden underneath a patch. Values the auto-fill leaves
 * blank (trimester Q4) are not touched, so archive data is preserved. Returns
 * null when the PDF has no readable text layer (scanned uploads) or the grade
 * block cannot be located.
 */
export async function patchSf10Pdf(
  original: Buffer,
  filled: AutoFillPatchRow[],
): Promise<Buffer | null> {
  const runs = extractPdfTextRuns(original);
  if (runs.length === 0) return null;
  const blocks = findGradeBlocks(groupPdfLines(runs));
  if (blocks.length === 0) return null;

  const byGrade = new Map<string, AutoFillPatchRow[]>();
  for (const row of filled) {
    const list = byGrade.get(row.gradeLevel) ?? [];
    list.push(row);
    byGrade.set(row.gradeLevel, list);
  }

  /** Old glyph spans to delete, keyed by content-stream object id. */
  const removals = new Map<number, Array<{ start: number; end: number }>>();
  const draws: Array<{ page: number; x: number; y: number; size: number; text: string }> = [];

  for (const [grade, rows] of byGrade) {
    const block = blocks.find((b) => b.grade === grade);
    if (!block) continue;
    const anchors = columnAnchors(block);
    if (!anchors) continue;

    for (const row of rows) {
      const line = findSubjectLine(block, row.norm);
      if (!line) continue;

      const values: Array<number | string | null> = [
        row.quarters?.[0] ?? null,
        row.quarters?.[1] ?? null,
        row.quarters?.[2] ?? null,
        row.quarters?.[3] ?? null,
        row.rating ?? null,
        row.remarks ?? null,
      ];

      values.forEach((value, index) => {
        if (value == null || value === "") return;
        const anchor = anchors[index];
        // Column limits: midpoints between header anchors, so every old run in
        // the target cell is removed — not just the one nearest the anchor.
        const lower = index === 0 ? anchor - 30 : (anchors[index - 1] + anchor) / 2;
        const upper =
          index === anchors.length - 1
            ? Number.POSITIVE_INFINITY
            : (anchor + anchors[index + 1]) / 2;
        const cellRuns = line.runs.filter(
          (r) =>
            r.text.trim() !== "" &&
            Math.abs(r.y - line.y) <= 2.5 &&
            r.x >= lower &&
            r.x < upper &&
            matchSingleSubject(r.text) == null,
        );

        for (const old of cellRuns) {
          const list = removals.get(old.streamId) ?? [];
          list.push({ start: old.start, end: old.end });
          removals.set(old.streamId, list);
        }

        // Nearest existing run gives the original x + baseline.
        let existing: (typeof cellRuns)[number] | null = null;
        let best = Number.POSITIVE_INFINITY;
        for (const cell of cellRuns) {
          const distance = Math.abs(cell.x - anchor);
          if (distance < best) {
            best = distance;
            existing = cell;
          }
        }
        draws.push({
          page: block.page,
          x: existing?.x ?? anchor,
          y: existing?.y ?? line.y,
          size: existing?.size ?? line.runs[0]?.size ?? 10,
          text: String(value),
        });
      });
    }
  }

  if (draws.length === 0) return null;

  // Create the new document first: delete the old glyphs, then draw the new
  // values on the same page. `original` is never mutated.
  const stripped = await stripPdfTextSpans(original, removals);

  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.load(stripped ?? original);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();

  for (const draw of draws) {
    const page = pages[draw.page - 1];
    if (!page) continue;
    page.drawText(draw.text, {
      x: draw.x,
      y: draw.y,
      size: draw.size,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

/** Build the same SF10 table as a PDF — fallback for PDFs with no text layer. */
export async function buildSf10Pdf(input: GeneratedSf10Input): Promise<Buffer> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setCreator("E-Zentra (MSAT)");
  doc.setCreationDate(input.generatedAt ?? new Date());

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 36;
  const tableWidth = pageWidth - margin * 2;
  // Subject, Q1–Q4, Final, Remarks.
  const columns = [0.43, 0.09, 0.09, 0.09, 0.09, 0.09, 0.12].map(
    (ratio) => ratio * tableWidth,
  );
  const xs: number[] = [margin];
  for (const w of columns) xs.push(xs[xs.length - 1] + w);

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const newPage = () => {
    page = doc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };
  const ensure = (height: number) => {
    if (y - height < margin) newPage();
  };
  const drawText = (
    value: string,
    x: number,
    atY: number,
    opts: { size?: number; isBold?: boolean; color?: [number, number, number] } = {},
  ) => {
    page.drawText(value, {
      x,
      y: atY,
      size: opts.size ?? 9,
      font: opts.isBold ? bold : font,
      color: rgb(...(opts.color ?? [0.1, 0.1, 0.1])),
    });
  };
  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: 0.5,
      color: rgb(0.6, 0.6, 0.6),
    });
  };

  drawText("LEARNER'S PERMANENT ACADEMIC RECORD (SF10)", margin, y - 16, {
    size: 13,
    isBold: true,
  });
  y -= 30;
  const info: Array<[string, string]> = [
    ["Name", input.learnerName],
    ["LRN", input.lrn],
    ["Grade Level", input.gradeLevel],
  ];
  if (input.schoolYear) info.push(["School Year", input.schoolYear]);
  for (const [label, value] of info) {
    drawText(`${label}: ${value}`, margin, y, { size: 9 });
    y -= 14;
  }
  y -= 8;

  const groups = new Map<string, OcrSubjectPayload[]>();
  for (const s of input.subjects) {
    const grade = s.gradeLevel ?? input.gradeLevel;
    const list = groups.get(grade) ?? [];
    list.push(s);
    groups.set(grade, list);
  }
  const gradeOf = (g: string) => {
    const idx = GRADE_ORDER.indexOf(g);
    return idx === -1 ? 99 : idx;
  };
  const grades = [...groups.keys()].sort(
    (a, b) => gradeOf(a) - gradeOf(b) || a.localeCompare(b),
  );

  const rowHeight = 15;
  const headers = ["Subject", "Q1", "Q2", "Q3", "Q4", "Final", "Remarks"];

  for (const grade of grades) {
    ensure(60);
    drawText(`Grade ${grade.replace(/^G/, "")}`, margin, y, { size: 10, isBold: true });
    y -= 6;
    drawLine(margin, y, pageWidth - margin, y);
    y -= rowHeight;
    ensure(rowHeight);
    headers.forEach((label, i) => {
      const w = bold.widthOfTextAtSize(label, 8);
      drawText(label, xs[i] + Math.max(2, (columns[i] - w) / 2), y + 4, {
        size: 8,
        isBold: true,
      });
    });
    drawLine(margin, y, pageWidth - margin, y);
    y -= 1;

    const subjects = [...(groups.get(grade) ?? [])].sort((a, b) =>
      (a.rawName || a.norm).localeCompare(b.rawName || b.norm),
    );
    for (const s of subjects) {
      ensure(rowHeight);
      const quarters = s.quarters ?? [];
      const final = s.rating ?? s.grade ?? null;
      const remarks = s.remarks ?? (final != null ? (final >= 75 ? "PASSED" : "FAILED") : "");
      const values = [
        s.rawName || s.norm,
        quarters[0]?.toString() ?? "",
        quarters[1]?.toString() ?? "",
        quarters[2]?.toString() ?? "",
        quarters[3]?.toString() ?? "",
        final?.toString() ?? "",
        remarks,
      ];
      values.forEach((value, i) => {
        const w = font.widthOfTextAtSize(value, 8);
        const x =
          i === 0 || i === 6 ? xs[i] + 2 : xs[i] + Math.max(2, (columns[i] - w) / 2);
        drawText(value, x, y + 4, { size: 8 });
      });
      drawLine(margin, y, pageWidth - margin, y);
      y -= rowHeight;
    }
    y -= 10;
  }

  ensure(24);
  drawText(
    `Generated by E-Zentra on ${(input.generatedAt ?? new Date()).toLocaleString("en-PH")} — auto-filled from adviser-approved finals.`,
    margin,
    y,
    { size: 8, color: [0.42, 0.45, 0.5] },
  );

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

/**
 * Choose the output format from the original upload: PDF originals become a
 * new document built from the upload's own layout (old grade glyphs replaced,
 * not overlaid), XLSX originals become a patched copy of the workbook, and
 * anything without a readable original (e.g. a scanned PDF) falls back to the
 * standard generated workbook.
 */
export async function renderAutoFillFile(
  input: RenderAutoFillFileInput,
): Promise<RenderedSf10File> {
  const { original } = input;
  const isPdf = original?.ext === "pdf" || original?.mimeType === PDF_MIME;
  const isXlsx =
    original != null &&
    (original.ext === "xlsx" || isXlsxUpload(original.mimeType, `file.${original.ext}`));

  if (isXlsx) {
    try {
      const buffer = await patchSf10Workbook(original.buffer, input.filled);
      return { buffer, ext: "xlsx", mimeType: XLSX_MIME };
    } catch {
      // Fall through to the standard workbook — still an Excel file.
    }
  }
  if (isPdf) {
    // Patch the uploaded PDF: same document/layout, only the auto-filled cells
    // change. Scanned uploads (no text layer) still fall back to the rebuilt
    // SF10-layout PDF below.
    try {
      const buffer = await patchSf10Pdf(original.buffer, input.filled);
      if (buffer) return { buffer, ext: "pdf", mimeType: PDF_MIME };
    } catch {
      // Fall through to the rebuilt PDF.
    }
    try {
      const buffer = await buildSf10Pdf(input);
      return { buffer, ext: "pdf", mimeType: PDF_MIME };
    } catch {
      // Fall through to the standard workbook.
    }
  }
  const buffer = await buildSf10Workbook(input);
  return { buffer, ext: "xlsx", mimeType: XLSX_MIME };
}

/**
 * Render the merged SF10 payload into a fresh spreadsheet so an auto-fill run
 * leaves a real, downloadable file — not just updated JSON next to the old
 * scan. Mirrors the printed SF10 layout (subject, Q1–Q4, final, remarks) and
 * keeps every grade block present in the payload (prior years included).
 */
export async function buildSf10Workbook(input: GeneratedSf10Input): Promise<Buffer> {
  const ExcelJS = await excelJs();

  const wb = new ExcelJS.Workbook();
  wb.creator = "E-Zentra (MSAT)";
  wb.created = input.generatedAt ?? new Date();

  const ws = wb.addWorksheet("SF10", {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      horizontalCentered: true,
    },
  });

  ws.columns = [
    { width: 34 },
    { width: 8 },
    { width: 8 },
    { width: 8 },
    { width: 8 },
    { width: 11 },
    { width: 12 },
  ];

  const thin = { style: "thin" as const, color: { argb: "FF9CA3AF" } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };
  const center = { vertical: "middle" as const, horizontal: "center" as const, wrapText: true };
  const left = { vertical: "middle" as const, horizontal: "left" as const, wrapText: true };

  let row = 1;
  ws.mergeCells(row, 1, row, 7);
  const title = ws.getCell(row, 1);
  title.value = "LEARNER'S PERMANENT ACADEMIC RECORD (SF10)";
  title.font = { size: 14, bold: true };
  title.alignment = center;
  row += 2;

  const info: Array<[string, string]> = [
    ["Name", input.learnerName],
    ["LRN", input.lrn],
    ["Grade Level", input.gradeLevel],
  ];
  if (input.schoolYear) info.push(["School Year", input.schoolYear]);
  for (const [label, value] of info) {
    ws.getCell(row, 1).value = label;
    ws.getCell(row, 1).font = { bold: true };
    ws.mergeCells(row, 2, row, 7);
    ws.getCell(row, 2).value = value;
    row += 1;
  }
  row += 1;

  const groups = new Map<string, OcrSubjectPayload[]>();
  for (const s of input.subjects) {
    const grade = s.gradeLevel ?? input.gradeLevel;
    const list = groups.get(grade) ?? [];
    list.push(s);
    groups.set(grade, list);
  }

  const grades = [...groups.keys()].sort((a, b) => {
    const ia = GRADE_ORDER.indexOf(a);
    const ib = GRADE_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });

  for (const grade of grades) {
    ws.mergeCells(row, 1, row, 7);
    const header = ws.getCell(row, 1);
    header.value = `Grade ${grade.replace(/^G/, "")}`;
    header.font = { bold: true, size: 11 };
    header.alignment = left;
    row += 1;

    const columns = ["Subject", "Q1", "Q2", "Q3", "Q4", "Final", "Remarks"];
    columns.forEach((label, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = label;
      cell.font = { bold: true };
      cell.alignment = center;
      cell.border = border;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
    });
    row += 1;

    const subjects = [...(groups.get(grade) ?? [])].sort((a, b) =>
      (a.rawName || a.norm).localeCompare(b.rawName || b.norm),
    );
    for (const s of subjects) {
      const quarters = s.quarters ?? [];
      const final = s.rating ?? s.grade ?? null;
      const remarks = s.remarks ?? (final != null ? (final >= 75 ? "PASSED" : "FAILED") : "");
      const values = [
        s.rawName || s.norm,
        quarters[0] ?? "",
        quarters[1] ?? "",
        quarters[2] ?? "",
        quarters[3] ?? "",
        final ?? "",
        remarks,
      ];
      values.forEach((value, i) => {
        const cell = ws.getCell(row, i + 1);
        cell.value = value as string | number;
        cell.alignment = i === 0 || i === 6 ? left : center;
        cell.border = border;
      });
      row += 1;
    }
    row += 1;
  }

  ws.mergeCells(row, 1, row, 7);
  const footer = ws.getCell(row, 1);
  footer.value = `Generated by E-Zentra on ${(input.generatedAt ?? new Date()).toLocaleString("en-PH")} — auto-filled from adviser-approved finals.`;
  footer.font = { italic: true, size: 9, color: { argb: "FF6B7280" } };
  footer.alignment = left;

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
