import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFile } from "node:fs/promises";

type ExcelJSModule = typeof import("exceljs");

export interface OcForm01Data {
  observerName: string;

  gradeSection: string;

  observationDate: string;

  observationTime: string;
  studentName: string;
  descriptionOfIncident: string;
  descriptionOfLocation: string;
  notesRecommendationsActions: string;
  classPerformance: string;
  attendanceSummary: string;

  adviserName: string;

  signatureImage?: Uint8Array;
}

const SHEET_NAME = "Anecdotal Report";
const FORM_CODE = "GCForm-01";
const ARIAL = "Arial";
const THIN = { style: "thin" as const, color: { argb: "FF000000" } };

async function loadLogos(): Promise<{ deped: Uint8Array; msat: Uint8Array }> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const [deped, msat] = await Promise.all([
    readFile(path.join(here, "assets", "deped-logo.png")),
    readFile(path.join(here, "assets", "msat-logo.png")),
  ]);
  return { deped, msat };
}

function fitParagraphBlock(
  ws: import("exceljs").Worksheet,
  blockStartRow: number,
  blockRowCount: number,
  baseRowHeight: number,
  text: string
): void {
  if (!text.trim()) return;
  const charsPerLine = 80;
  const lineHeight = 15;
  const lines = Math.max(
    1,
    Math.ceil(text.trim().length / charsPerLine) +
      (text.match(/\n/g)?.length ?? 0)
  );
  const needed = lines * lineHeight;
  const base = blockRowCount * baseRowHeight;
  if (needed > base) {
    ws.getRow(blockStartRow + blockRowCount - 1).height =
      baseRowHeight + (needed - base);
  }
}

export async function buildOcForm01Workbook(
  data: OcForm01Data
): Promise<import("exceljs").Workbook> {

  const imported = (await import("exceljs")) as unknown as ExcelJSModule & {
    default?: ExcelJSModule;
  };
  const ExcelJS: ExcelJSModule = imported.default ?? imported;
  const wb = new ExcelJS.Workbook();
  wb.creator = "E-Zentra (MSAT)";
  wb.created = new Date();

  const ws = wb.addWorksheet(SHEET_NAME, {
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      horizontalCentered: true,
      printArea: "A1:R54",
    },
  });
  ws.pageSetup.margins = {
    left: 0.7,
    right: 0.7,
    top: 0.75,
    bottom: 0.75,
    header: 0.3,
    footer: 0.3,
  };

  ws.pageSetup.printArea = "A1:R54";
  ws.views = [{ showGridLines: false }];

  ws.getColumn(1).width = 1.5;
  for (let c = 2; c <= 17; c++) ws.getColumn(c).width = 6.5;
  ws.getColumn(18).width = 1.5;

  const center = {
    vertical: "middle" as const,
    horizontal: "center" as const,
    wrapText: true,
  };
  const leftMid = {
    vertical: "middle" as const,
    horizontal: "left" as const,
    wrapText: true,
  };

  function headerRow(row: number, value: string, opts: { size?: number; bold?: boolean } = {}): void {
    ws.mergeCells(`A${row}:R${row}`);
    const cell = ws.getCell(`A${row}`);
    cell.value = value;
    cell.font = { name: ARIAL, size: opts.size ?? 9, bold: !!opts.bold };
    cell.alignment = center;
  }

  function sectionLabel(row: number, value: string): void {
    ws.mergeCells(`B${row}:Q${row}`);
    const cell = ws.getCell(`B${row}`);
    cell.value = value;
    cell.font = { name: ARIAL, size: 12, bold: true };
    cell.alignment = leftMid;
    ws.getRow(row).height = 22;
  }

  function fieldRow(
    row: number,
    leftLabel: string,
    leftLabelRange: string,
    leftInputRange: string,
    leftValue: string,
    rightLabel?: string,
    rightLabelRange?: string,
    rightInputRange?: string,
    rightValue?: string
  ): void {
    ws.getRow(row).height = 24;
    ws.mergeCells(leftLabelRange);
    const label = ws.getCell(leftLabelRange.split(":")[0]);
    label.value = leftLabel;
    label.font = { name: ARIAL, size: 12 };
    label.alignment = { vertical: "middle", horizontal: "left" };
    ws.mergeCells(leftInputRange);
    const input = ws.getCell(leftInputRange.split(":")[0]);
    input.value = leftValue;
    input.font = { name: ARIAL, size: 12 };
    input.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    input.border = { bottom: THIN };
    if (rightLabel && rightLabelRange && rightInputRange) {
      ws.mergeCells(rightLabelRange);
      const rLabel = ws.getCell(rightLabelRange.split(":")[0]);
      rLabel.value = rightLabel;
      rLabel.font = { name: ARIAL, size: 12 };
      rLabel.alignment = { vertical: "middle", horizontal: "left" };
      ws.mergeCells(rightInputRange);
      const rInput = ws.getCell(rightInputRange.split(":")[0]);
      rInput.value = rightValue ?? "";
      rInput.font = { name: ARIAL, size: 12 };
      rInput.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      rInput.border = { bottom: THIN };
    }
  }

  function ruleRow(row: number, height = 22): void {
    ws.mergeCells(`B${row}:Q${row}`);
    ws.getCell(`B${row}`).border = { bottom: THIN };
    ws.getRow(row).height = height;
  }

  function paragraphBlock(
    startRow: number,
    rowCount: number,
    text: string,
    baseHeight = 22
  ): void {
    const endRow = startRow + rowCount - 1;
    ws.mergeCells(`B${startRow}:Q${endRow}`);
    const cell = ws.getCell(`B${startRow}`);
    cell.value = text;
    cell.font = { name: ARIAL, size: 12 };
    cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
    cell.border = { left: THIN, right: THIN, bottom: THIN };
    for (let r = startRow; r <= endRow; r++) ws.getRow(r).height = baseHeight;
    fitParagraphBlock(ws, startRow, rowCount, baseHeight, text);
  }

  ws.getRow(1).height = 6;
  ws.getRow(2).height = 13;
  headerRow(2, "Republic of the Philippines");
  ws.getRow(3).height = 13;
  headerRow(3, "Department of Education");
  ws.getRow(4).height = 13;
  headerRow(4, "Region XI");
  ws.getRow(5).height = 13;
  headerRow(5, "Schools Division of the City of Mati");
  ws.getRow(6).height = 17;
  headerRow(6, "MATI SCHOOL OF ARTS AND TRADES", { size: 12, bold: true });
  ws.getRow(7).height = 13;
  headerRow(7, "Quezon Ave., Barangay Sainz, City of Mati, Davao Oriental");
  ws.getRow(8).height = 13;
  headerRow(8, "Tel # (087) 388-3448");
  ws.getRow(9).height = 13;
  ws.mergeCells("A9:R9");
  const email = ws.getCell("A9");
  email.value = "Email Add: msat.mati@deped.gov.ph";
  email.font = {
    name: ARIAL,
    size: 9,
    underline: true,
    color: { argb: "FF0563C1" },
  };
  email.alignment = center;

  ws.mergeCells("A10:R10");
  ws.getCell("A10").border = {
    bottom: { style: "double", color: { argb: "FF000000" } },
  };
  ws.getRow(10).height = 8;

  ws.mergeCells("B11:Q11");
  const title = ws.getCell("B11");
  title.value = "ANECDOTAL REPORT";
  title.font = { name: ARIAL, size: 12, bold: true };
  title.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  ws.getRow(11).height = 20;

  ws.mergeCells("B12:Q12");
  const code = ws.getCell("B12");
  code.value = FORM_CODE;
  code.font = { name: ARIAL, size: 12 };
  code.alignment = leftMid;
  ws.getRow(12).height = 18;

  ws.mergeCells("A13:R13");
  const confidential = ws.getCell("A13");
  confidential.value = "(Confidential)";
  confidential.font = { name: ARIAL, size: 12, bold: true };
  confidential.alignment = center;
  ws.getRow(13).height = 20;

  const boxTop = 14;
  fieldRow(14, "Observer: ", "B14:C14", "D14:I14", data.observerName, "Grade & Section: ", "J14:L14", "M14:Q14", data.gradeSection);
  fieldRow(15, "Observation Date: ", "B15:D15", "E15:I15", data.observationDate, "Observation Time: ", "J15:L15", "M15:Q15", data.observationTime);
  fieldRow(16, "Student Name(Subject): ", "B16:E16", "F16:Q16", data.studentName);
  fieldRow(17, "Grade & Section: ", "B17:D17", "E17:Q17", data.gradeSection);

  ws.mergeCells("B18:Q18");
  ws.getRow(18).height = 12;

  sectionLabel(19, "Description of the Incident:");
  paragraphBlock(20, 5, data.descriptionOfIncident);
  ws.mergeCells("B25:Q25");
  ws.getRow(25).height = 12;

  sectionLabel(26, "Description of the Location/ Setting:");
  paragraphBlock(27, 5, data.descriptionOfLocation);
  ws.mergeCells("B32:Q32");
  ws.getRow(32).height = 12;

  sectionLabel(33, "Notes/ Recommendations/ Actions:");
  paragraphBlock(34, 5, data.notesRecommendationsActions);
  ws.mergeCells("B39:Q39");
  ws.getRow(39).height = 12;

  ws.mergeCells("B40:Q40");
  const academic = ws.getCell("B40");
  academic.value = "Academic Information of the Subject/Client:";
  academic.font = { name: ARIAL, size: 12, bold: true };
  academic.alignment = leftMid;
  academic.border = {
    top: { style: "medium", color: { argb: "FF000000" } },
  };
  ws.getRow(40).height = 24;

  fieldRow(41, "Class Performance: ", "B41:E41", "F41:Q41", data.classPerformance);
  fieldRow(42, "Attendance in Classes for the last 2 weeks/Month: ", "B42:I42", "J42:Q42", data.attendanceSummary);

  ruleRow(43);
  ruleRow(44);
  const boxBottom = 44;

  for (let row = boxTop; row <= boxBottom; row++) {
    for (let col = 1; col <= 18; col++) {
      const cell = ws.getRow(row).getCell(col);
      const border = { ...(cell.border ?? {}) };
      if (row === boxTop) border.top = THIN;
      if (row === boxBottom) border.bottom = THIN;
      if (col === 1) border.left = THIN;
      if (col === 18) border.right = THIN;
      cell.border = border as import("exceljs").Borders;
    }
  }

  ws.mergeCells("B46:Q46");
  const prepared = ws.getCell("B46");
  prepared.value = "PREPARED BY:";
  prepared.font = { name: ARIAL, size: 12 };
  prepared.alignment = leftMid;
  ws.getRow(46).height = 20;

  ws.getRow(47).height = 28;
  ws.mergeCells("B47:G47");
  ws.mergeCells("H47:Q47");

  const signatureName = ws.getCell("H47");
  signatureName.value = data.adviserName;
  signatureName.font = { name: ARIAL, size: 12 };
  signatureName.alignment = center;
  signatureName.border = { bottom: THIN };

  ws.mergeCells("H48:Q48");
  const caption = ws.getCell("H48");
  caption.value = "ADVISER'S SIGNATURE OVER PRINTED NAME";
  caption.font = { name: ARIAL, size: 12 };
  caption.alignment = center;
  ws.getRow(48).height = 18;

  try {
    const { deped, msat } = await loadLogos();
    const depedId = wb.addImage({
      base64: Buffer.from(deped).toString("base64"),
      extension: "png",
    });
    ws.addImage(depedId, {
      tl: { col: 0.1, row: 1.2 },
      ext: { width: 105, height: 54 },
    });
    const msatId = wb.addImage({
      base64: Buffer.from(msat).toString("base64"),
      extension: "png",
    });
    ws.addImage(msatId, {
      tl: { col: 13.6, row: 1.1 },
      ext: { width: 68, height: 68 },
    });

    if (data.signatureImage && data.signatureImage.length > 0) {
      const sigId = wb.addImage({
        base64: Buffer.from(data.signatureImage).toString("base64"),
        extension: "png",
      });
      ws.addImage(sigId, {
        tl: { col: 10, row: 46.05 },
        ext: { width: 150, height: 36 },
      });
    }
  } catch {

  }

  return wb;
}
