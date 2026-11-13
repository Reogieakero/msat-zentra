import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

import type { OcForm01Data } from "./ocform01.service.js";

/**
 * Single-page A4 PDF twin of the GCForm-01 .xlsx export, drawn directly from
 * the same {@link OcForm01Data} with pdf-lib (pure JS — no LibreOffice or
 * headless Chrome, so it runs on plain Node/PaaS hosts).
 *
 * Geometry mirrors `ocform01.service.ts` row-for-row (Excel row heights ARE
 * points, so the numbers transfer almost 1:1): DepEd header + double rule,
 * ANECDOTAL REPORT / GCForm-01 / (Confidential) title block, the bordered
 * observer box, ruled narrative blocks, academic section, and the PREPARED
 * BY footer with the drawn signature above the printed name. Like the
 * workbook's `fitToPage` (fit 1×1), content is uniformly scaled to fit one
 * page — never clipped, never paginated.
 */

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN_X = 50.4; // 0.7in sides (matches workbook margins)
const MARGIN_TOP = 54; // ~0.75in
const MARGIN_BOTTOM = 54;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const USABLE_H = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM;

const INK = rgb(0, 0, 0);
const EMAIL_BLUE = rgb(0x05 / 255, 0x63 / 255, 0xc1 / 255);

async function loadLogos(): Promise<{ deped: Uint8Array; msat: Uint8Array }> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const [deped, msat] = await Promise.all([
    readFile(path.join(here, "assets", "deped-logo.png")),
    readFile(path.join(here, "assets", "msat-logo.png")),
  ]);
  return { deped, msat };
}

function wrapText(
  text: string,
  maxWidth: number,
  size: number,
  font: PDFFont
): string[] {
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    const words = raw.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const trial = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(trial, size) <= maxWidth || !line) {
        line = trial;
      } else {
        out.push(line);
        line = w;
      }
    }
    out.push(line);
  }
  return out;
}

interface ParaBlock {
  heading: string;
  lines: string[];
  /** Ruled rows drawn (text lines + blank rules filling the minimum). */
  rows: number;
  /** Content-space height (label + ruled area). */
  height: number;
}

const PARA_LINE_H = 15;
const PARA_MIN_LINES = 5;
const PARA_LABEL_H = 22;
const PARA_PAD_TOP = 4;
// Notebook rhythm, all in content-space points: first baseline sits
// PARA_FIRST_BASE below the area top, each ruled row follows every
// PARA_LINE_H, the rule sits PARA_RULE_BELOW under its baseline, and
// PARA_BOT_PAD separates the last rule from the bottom border.
const PARA_FIRST_BASE = PARA_PAD_TOP + 12 * 0.85; // 14.2
const PARA_RULE_BELOW = 2.5;
const PARA_BOT_PAD = 6;

function paraBlock(heading: string, text: string, body: PDFFont): ParaBlock {
  const lines = wrapText(text.trim() || " ", CONTENT_W - 20 - 8, 12, body);
  const rows = Math.max(lines.length, PARA_MIN_LINES);
  const areaH = PARA_FIRST_BASE + (rows - 1) * PARA_LINE_H + PARA_RULE_BELOW + PARA_BOT_PAD;
  return { heading, lines, rows, height: PARA_LABEL_H + areaH };
}

interface FieldRow {
  leftLabel: string;
  leftValue: string[];
  rightLabel?: string;
  rightValue?: string[];
  height: number;
}

const FIELD_H = 24;

function fieldRow(
  leftLabel: string,
  leftText: string,
  body: PDFFont,
  rightLabel?: string,
  rightText?: string
): FieldRow {
  // Two-pair rows split the inner width in halves; full rows span it.
  const half = (CONTENT_W - 20) / 2;
  const measure = (label: string) => body.widthOfTextAtSize(label, 12) + 4;
  const leftInputW = rightLabel ? half - measure(leftLabel) : CONTENT_W - 20 - measure(leftLabel);
  const leftValue = wrapText(leftText.trim() || " ", Math.max(leftInputW, 40), 12, body);
  let rightValue: string[] | undefined;
  if (rightLabel) {
    const rightInputW = half - measure(rightLabel);
    rightValue = wrapText((rightText ?? "").trim() || " ", Math.max(rightInputW, 40), 12, body);
  }
  const lines = Math.max(leftValue.length, rightValue?.length ?? 1);
  return {
    leftLabel,
    leftValue,
    rightLabel,
    rightValue,
    height: Math.max(FIELD_H, lines * 14 + 10),
  };
}

/** Filesystem-safe `OCForm-01_Juan-Dela-Cruz_2026-09-05.pdf`. */
export function ocForm01PdfFilename(studentName: string, when: Date): string {
  const safe =
    studentName
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "record";
  return `OCForm-01_${safe}_${when.toISOString().slice(0, 10)}.pdf`;
}

export async function buildOcForm01Pdf(data: OcForm01Data): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const body = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let depedPng;
  let msatPng;
  let sigPng;
  try {
    const { deped, msat } = await loadLogos();
    depedPng = await pdf.embedPng(deped);
    msatPng = await pdf.embedPng(msat);
    if (data.signatureImage && data.signatureImage.length > 0) {
      sigPng = await pdf.embedPng(data.signatureImage);
    }
  } catch {
    // Logos/signature are decorative — missing assets never break the PDF.
  }

  // ---- Measure pass (content-space points, origin = top of content) ----
  const headerH = 6 + 13 * 4 + 17 + 13 * 3 + 8; // spacer + 8 header rows + rule gap
  const titleH = 20 + 18 + 20;

  const f14 = fieldRow("Observer: ", data.observerName, body, "Grade & Section: ", data.gradeSection);
  const f15 = fieldRow("Observation Date: ", data.observationDate, body, "Observation Time: ", data.observationTime);
  const f16 = fieldRow("Student Name(Subject): ", data.studentName, body);
  const f17 = fieldRow("Grade & Section: ", data.gradeSection, body);
  const gap12 = 12;
  const incident = paraBlock("Description of the Incident:", data.descriptionOfIncident, body);
  const location = paraBlock("Description of the Location/ Setting:", data.descriptionOfLocation, body);
  const notes = paraBlock("Notes/ Recommendations/ Actions:", data.notesRecommendationsActions, body);
  const academicH = 24;
  const f41 = fieldRow("Class Performance: ", data.classPerformance, body);
  const f42 = fieldRow(
    "Attendance in Classes for the last 2 weeks/Month: ",
    data.attendanceSummary,
    body
  );
  const ruleH = 22;
  const boxInnerH =
    8 + // top padding
    f14.height +
    f15.height +
    f16.height +
    f17.height +
    gap12 +
    incident.height +
    gap12 +
    location.height +
    gap12 +
    notes.height +
    gap12 +
    academicH +
    f41.height +
    f42.height +
    ruleH +
    ruleH +
    12; // bottom padding

  const footerGap = 8;
  const preparedH = 20;
  const sigImgH = sigPng ? 27 + 4 : 0;
  const sigLineH = 28;
  const captionH = 18;

  const totalH =
    headerH + titleH + boxInnerH + 2 /* box border */ + footerGap + preparedH + sigImgH + sigLineH + captionH;
  const scale = Math.min(1, USABLE_H / totalH);

  // ---- Draw pass ----
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  // Content-space → page-space mapping (uniform scale, top-down cursor).
  // Horizontally centered like the workbook's `horizontalCentered: true` —
  // anchoring at MARGIN_X would pile all fit-to-page slack on the right.
  const X = (x: number) => (PAGE_W - CONTENT_W * scale) / 2 + x * scale;
  const W = (w: number) => w * scale;
  const FS = (size: number) => Math.max(size * scale, 4);
  // Top edge of a content-space row at cursor `t` with height `h` → page Y.
  const topY = (t: number) => PAGE_H - MARGIN_TOP - t * scale;
  const botY = (t: number, h: number) => PAGE_H - MARGIN_TOP - (t + h) * scale;
  const LW = (w: number) => Math.max(w * scale, 0.4);

  let t = 0; // content-space cursor (distance from content top)

  const centered = (
    text: string,
    size: number,
    font: PDFFont,
    h: number,
    color = INK,
    underline = false
  ) => {
    const fs = FS(size);
    const w = font.widthOfTextAtSize(text, fs);
    const x = X((CONTENT_W - w / scale) / 2);
    const baseline = botY(t, h) + ((h * scale - fs) / 2);
    page.drawText(text, { x, y: baseline, size: fs, font, color });
    if (underline) {
      page.drawLine({
        start: { x, y: baseline - 2 },
        end: { x: x + w, y: baseline - 2 },
        thickness: LW(0.75),
        color,
      });
    }
    t += h;
  };

  const leftLine = (text: string, size: number, font: PDFFont, h: number, color = INK) => {
    const fs = FS(size);
    const baseline = botY(t, h) + ((h * scale - fs) / 2);
    page.drawText(text, { x: X(0), y: baseline, size: fs, font, color });
    t += h;
  };

  // Header (rows 2-9 wording/order match the workbook).
  t += 6; // row-1 logo spacer
  centered("Republic of the Philippines", 9, body, 13);
  centered("Department of Education", 9, body, 13);
  centered("Region XI", 9, body, 13);
  centered("Schools Division of the City of Mati", 9, body, 13);
  centered("MATI SCHOOL OF ARTS AND TRADES", 12, bold, 17);
  centered("Quezon Ave., Barangay Sainz, City of Mati, Davao Oriental", 9, body, 13);
  centered("Tel # (087) 388-3448", 9, body, 13);
  centered("Email Add: msat.mati@deped.gov.ph", 9, body, 13, EMAIL_BLUE, true);
  // Double rule under the header (A10 in the workbook).
  const ruleTop = topY(t);
  page.drawLine({
    start: { x: X(0), y: ruleTop - LW(1) },
    end: { x: X(CONTENT_W), y: ruleTop - LW(1) },
    thickness: LW(1),
    color: INK,
  });
  page.drawLine({
    start: { x: X(0), y: ruleTop - 4 * scale },
    end: { x: X(CONTENT_W), y: ruleTop - 4 * scale },
    thickness: LW(1),
    color: INK,
  });
  t += 8;

  // Logos flank the header text (same artwork/placement as the workbook).
  if (depedPng) {
    page.drawImage(depedPng, {
      x: X(0),
      y: topY(8) - W(40.5),
      width: W(78.75),
      height: W(40.5),
    });
  }
  if (msatPng) {
    page.drawImage(msatPng, {
      x: X(CONTENT_W) - W(51),
      y: topY(4) - W(51),
      width: W(51),
      height: W(51),
    });
  }

  // Title block.
  leftLine("ANECDOTAL REPORT", 12, bold, 20);
  leftLine("GCForm-01", 12, body, 18);
  centered("(Confidential)", 12, bold, 20);

  // Observer box (bordered B14:Q44 equivalent).
  const boxTop = t;
  let it = t + 8; // inner cursor (8pt top padding)
  const IX = 10; // inner x inset (gutter equivalent)
  const IW = CONTENT_W - IX * 2;

  const drawField = (row: FieldRow, twoPair: boolean) => {
    const drawPair = (x0: number, pairW: number, label: string, lines: string[]) => {
      const fs = FS(12);
      const labelW = body.widthOfTextAtSize(label, fs);
      const baseline = botY(it, row.height) + ((row.height * scale - fs) / 2);
      page.drawText(label, { x: X(IX + x0), y: baseline, size: fs, font: body, color: INK });
      let ly = baseline;
      for (const line of lines) {
        page.drawText(line, {
          x: X(IX + x0) + labelW + 4 * scale,
          y: ly,
          size: fs,
          font: body,
          color: INK,
        });
        page.drawLine({
          start: { x: X(IX + x0) + labelW + 4 * scale, y: ly - 2 },
          end: { x: X(IX + x0 + pairW), y: ly - 2 },
          thickness: LW(0.75),
          color: INK,
        });
        ly -= 14 * scale;
      }
    };
    if (twoPair && row.rightLabel) {
      drawPair(0, IW / 2 - 6, row.leftLabel, row.leftValue);
      drawPair(IW / 2 + 6, IW / 2 - 6, row.rightLabel, row.rightValue ?? [" "]);
    } else {
      drawPair(0, IW, row.leftLabel, row.leftValue);
    }
    it += row.height;
  };

  const drawPara = (block: ParaBlock) => {
    const fs = FS(12);
    const labelBase = botY(it, PARA_LABEL_H) + ((PARA_LABEL_H * scale - fs) / 2);
    page.drawText(block.heading, { x: X(IX), y: labelBase, size: fs, font: bold, color: INK });
    it += PARA_LABEL_H;
    const areaH = block.height - PARA_LABEL_H;
    const areaTop = topY(it);
    // Left / right / bottom borders (top stays open, like the workbook).
    const x0 = X(IX);
    const x1 = X(IX + IW);
    const yTop = areaTop;
    const yBot = areaTop - areaH * scale;
    page.drawLine({ start: { x: x0, y: yTop }, end: { x: x0, y: yBot }, thickness: LW(1), color: INK });
    page.drawLine({ start: { x: x1, y: yTop }, end: { x: x1, y: yBot }, thickness: LW(1), color: INK });
    page.drawLine({ start: { x: x0, y: yBot }, end: { x: x1, y: yBot }, thickness: LW(1), color: INK });
    // Notebook rules: one underline per text line plus blank ruled rows
    // filling the block to its minimum height (web ruled-paper parity).
    const ruleDy = Math.max(1, PARA_RULE_BELOW * scale);
    let ly = yTop - PARA_PAD_TOP * scale - fs * 0.85;
    for (let i = 0; i < block.rows; i++) {
      const line = block.lines[i] ?? "";
      if (line) {
        page.drawText(line, { x: x0 + 4 * scale, y: ly, size: fs, font: body, color: INK });
      }
      page.drawLine({
        start: { x: x0, y: ly - ruleDy },
        end: { x: x1, y: ly - ruleDy },
        thickness: LW(0.75),
        color: INK,
      });
      ly -= PARA_LINE_H * scale;
    }
    it += areaH;
  };

  const drawRuleRow = () => {
    const y = botY(it, ruleH) + 4 * scale;
    page.drawLine({
      start: { x: X(IX), y },
      end: { x: X(IX + IW), y },
      thickness: LW(0.75),
      color: INK,
    });
    it += ruleH;
  };

  drawField(f14, true);
  drawField(f15, true);
  drawField(f16, false);
  drawField(f17, false);
  it += gap12;
  drawPara(incident);
  it += gap12;
  drawPara(location);
  it += gap12;
  drawPara(notes);
  it += gap12;
  // Academic heading with medium top rule (row 40 in the workbook).
  page.drawLine({
    start: { x: X(IX), y: topY(it) },
    end: { x: X(IX + IW), y: topY(it) },
    thickness: LW(2),
    color: INK,
  });
  {
    const fs = FS(12);
    const baseline = botY(it, academicH) + ((academicH * scale - fs) / 2);
    page.drawText("Academic Information of the Subject/Client:", {
      x: X(IX),
      y: baseline,
      size: fs,
      font: bold,
      color: INK,
    });
  }
  it += academicH;
  drawField(f41, false);
  drawField(f42, false);
  drawRuleRow();
  drawRuleRow();
  it += 12; // bottom padding

  // Outer box outline.
  page.drawRectangle({
    x: X(0),
    y: botY(boxTop, it - boxTop),
    width: W(CONTENT_W),
    height: (it - boxTop) * scale,
    borderWidth: LW(1),
    borderColor: INK,
  });
  t = it;

  // Signature footer.
  t += footerGap;
  leftLine("PREPARED BY:", 12, body, preparedH);
  const lineX0 = X(CONTENT_W * 0.45);
  const lineX1 = X(CONTENT_W);
  if (sigPng) {
    page.drawImage(sigPng, {
      x: lineX0 + (lineX1 - lineX0 - W(112.5)) / 2,
      y: topY(t) - W(27),
      width: W(112.5),
      height: W(27),
    });
    t += sigImgH;
  }
  {
    const fs = FS(12);
    const nameW = body.widthOfTextAtSize(data.adviserName || "—", fs);
    const baseline = botY(t, sigLineH) + ((sigLineH * scale - fs) / 2);
    page.drawText(data.adviserName || "—", {
      x: lineX0 + (lineX1 - lineX0 - nameW) / 2,
      y: baseline,
      size: fs,
      font: body,
      color: INK,
    });
    page.drawLine({
      start: { x: lineX0, y: baseline - 2 },
      end: { x: lineX1, y: baseline - 2 },
      thickness: LW(0.75),
      color: INK,
    });
  }
  t += sigLineH;
  {
    const caption = "ADVISER'S SIGNATURE OVER PRINTED NAME";
    const fs = FS(12);
    const w = body.widthOfTextAtSize(caption, fs);
    const baseline = botY(t, captionH) + ((captionH * scale - fs) / 2);
    page.drawText(caption, {
      x: lineX0 + (lineX1 - lineX0 - w) / 2,
      y: baseline,
      size: fs,
      font: body,
      color: INK,
    });
  }
  t += captionH;

  return pdf.save();
}
