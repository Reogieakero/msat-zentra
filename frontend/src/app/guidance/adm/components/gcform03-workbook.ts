import type { Workbook, Worksheet } from "exceljs";
import type { GcForm03Data } from "@/services/guidance/gcform03.types";
import {
  splitGcForm03Block,
  templateConcernLabel,
  templateOthersLabel,
} from "@/services/guidance/gcform03.service";

const TEMPLATE_URL = encodeURI(
  "/referral forms/Referral Form - GCForm-03 v11.xlsx"
);
const SHEET_NAME = "Referral Form";
const CREST_URL = encodeURI(
  "/ocform01/Mati School of Arts and Trades Crest.png"
);
/** 1 css/excel px = 9525 EMU — anchor offsets are stored in EMU. */
const EMU_PER_PX = 9525;

type ExcelJSModule = {
  default?: { Workbook: new () => Workbook };
  Workbook: new () => Workbook;
};

async function loadExcelJS(): Promise<{ Workbook: new () => Workbook }> {
  const mod = (await import("exceljs")) as unknown as ExcelJSModule;
  return mod.default ?? mod;
}

function setValue(ws: Worksheet, address: string, value: string): void {
  ws.getCell(address).value = value ?? "";
}

function setPara(ws: Worksheet, address: string, value: string): void {
  const cell = ws.getCell(address);
  cell.value = value ?? "";
  const current = toRecord(cell.alignment);
  cell.style = {
    ...cell.style,
    alignment: { ...current, wrapText: true, vertical: "middle" },
  };
}

function centerCell(ws: Worksheet, address: string): void {
  const cell = ws.getCell(address);
  const current = toRecord(cell.alignment);
  cell.style = {
    ...cell.style,
    alignment: { ...current, horizontal: "center" },
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function fitBlock(
  ws: Worksheet,
  lastRow: number,
  baseHeight: number,
  text: string,
  perRowChars: number
): void {
  const t = (text ?? "").trim();
  if (!t) return;
  const lines = Math.max(
    1,
    Math.ceil(t.length / perRowChars) + (t.match(/\n/g)?.length ?? 0)
  );
  const needed = lines * 15;
  if (needed > baseHeight) {
    ws.getRow(lastRow).height = baseHeight + (needed - baseHeight);
  }
}

export async function loadGcForm03Template(): Promise<{
  wb: Workbook;
  ws: Worksheet;
}> {
  const ExcelJS = await loadExcelJS();
  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) {
    throw new Error(
      "The official referral template could not be loaded from the public folder."
    );
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await res.arrayBuffer());
  const ws = wb.getWorksheet(SHEET_NAME) ?? wb.worksheets[0];
  if (!ws) throw new Error("The referral template sheet is missing.");
  return { wb, ws };
}

/** Embedded image (template logo / stamped crest) as ExcelJS keeps it. */
type EmbeddedImage = {
  imageId?: number;
  range?: {
    tl?: {
      nativeCol?: number;
      nativeColOff?: number;
      nativeRow?: number;
      nativeRowOff?: number;
    };
  };
};

function embeddedImages(ws: Worksheet): EmbeddedImage[] {
  const getImages = (
    ws as unknown as { getImages?: () => EmbeddedImage[] }
  ).getImages;
  return typeof getImages === "function" ? getImages.call(ws) : [];
}

/** Position an embedded image `offset.x` px right / `offset.y` px down
    inside its anchor cell. Offsets are stored as EMU both in the file and
    in the sheet preview, so both stay in sync. */
function setImageOffsets(
  ws: Worksheet,
  imageId: number,
  offset: { x?: number; y?: number }
): void {
  const image = embeddedImages(ws).find((img) => img.imageId === imageId);
  const tl = image?.range?.tl;
  if (!tl) return;
  if (offset.x !== undefined) tl.nativeColOff = Math.round(offset.x * EMU_PER_PX);
  if (offset.y !== undefined) tl.nativeRowOff = Math.round(offset.y * EMU_PER_PX);
}

/**
 * Header composition tweaks, applied in-memory so the sheet preview, the
 * print output, and the downloaded .xlsx stay in sync:
 * - header text (rows 1–7) centers across B:I instead of B:J — dropping
 *   column J, which the crest sits in — so the block sits a little left;
 * - the DepEd logo (template image 0) is inset 60px from the left edge.
 */
function applyHeaderLayout(ws: Worksheet): void {
  setImageOffsets(ws, 0, { x: 60 });
  for (let r = 1; r <= 7; r++) {
    ws.unMergeCells(`B${r}:J${r}`);
    ws.mergeCells(`B${r}:I${r}`);
  }
}

export function fillGcForm03Sheet(ws: Worksheet, data: GcForm03Data): void {

  setValue(ws, "C11", data.studentName);
  setValue(ws, "I11", data.gradeSection);

  setValue(ws, "A13", templateConcernLabel("absences", data.concerns.absences));
  setValue(ws, "E13", templateConcernLabel("academic", data.concerns.academic));
  setValue(ws, "H13", templateConcernLabel("personal", data.concerns.personal));
  setValue(ws, "A14", templateConcernLabel("family", data.concerns.family));
  setValue(ws, "E14", templateConcernLabel("peer", data.concerns.peer));
  setValue(ws, "H14", templateOthersLabel(data.concerns.others));
  setValue(ws, "I14", data.concerns.others ? data.concerns.othersText : "");

  const detailsBase = ws.getRow(18).height ?? 26;
  const detailRows = splitGcForm03Block(data.detailsOfConcern, 3, 120);
  setPara(ws, "A16", detailRows[0]);
  setPara(ws, "A17", detailRows[1]);
  setPara(ws, "A18", detailRows[2]);
  fitBlock(ws, 18, detailsBase, detailRows[2], 120);

  const actions = [...data.referrerActions].slice(0, 5);
  while (actions.length < 5) actions.push({ date: "", action: "" });
  actions.forEach((row, i) => {
    const excelRow = 20 + i;
    setPara(ws, `B${excelRow}`, row.action);
    setValue(ws, `H${excelRow}`, row.date);
    centerCell(ws, `H${excelRow}`);
  });

  const recBase = ws.getRow(27).height ?? 28;
  const recRows = splitGcForm03Block(data.referrerRecommendations, 2, 120);
  setPara(ws, "A26", recRows[0]);
  setPara(ws, "A27", recRows[1]);
  fitBlock(ws, 27, recBase, recRows[1], 120);

  setValue(ws, "F28", data.referredByName);
  centerCell(ws, "F28");

  setValue(ws, "C31", data.receivedBy);
  centerCell(ws, "C31");
  setValue(ws, "G31", data.receivedDate);
  centerCell(ws, "G31");

  const callRows = [36, 37, 38];
  data.guidanceCalls.slice(0, 3).forEach((call, i) => {
    const r = callRows[i];
    setValue(ws, `C${r}`, call.checked ? "☑" : "☐");
    setValue(ws, `D${r}`, call.date);
    centerCell(ws, `D${r}`);
    setPara(ws, `F${r}`, call.subject);
    setPara(ws, `H${r}`, call.remarks);
  });

  const gRecBase = ws.getRow(41).height ?? 28;
  const gRecRows = splitGcForm03Block(data.guidanceRecommendations, 3, 100);
  setPara(ws, "C39", gRecRows[0]);
  setPara(ws, "A40", gRecRows[1]);
  setPara(ws, "A41", gRecRows[2]);
  fitBlock(ws, 41, gRecBase, gRecRows[2], 100);

  const followBase = ws.getRow(44).height ?? 28;
  const followRows = splitGcForm03Block(data.followUp, 3, 100);
  setPara(ws, "C42", followRows[0]);
  setPara(ws, "A43", followRows[1]);
  setPara(ws, "A44", followRows[2]);
  fitBlock(ws, 44, followBase, followRows[2], 100);

  setValue(ws, "A46", data.counselorName);
  centerCell(ws, "A46");
  setValue(ws, "G46", data.counselorDate);
  centerCell(ws, "G46");
}

/**
 * Stamp the school crest on the top-right of the header (row 1, inset 60px
 * from the right edge). Runs on the in-memory workbook, so the sheet HTML
 * preview, the printed sheet, and the downloaded .xlsx all carry it; a
 * failed fetch (offline) simply leaves the crest off the form.
 */
async function stampSchoolCrest(wb: Workbook, ws: Worksheet): Promise<void> {
  try {
    const res = await fetch(CREST_URL);
    if (!res.ok) return;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(
        null,
        Array.from(bytes.subarray(i, i + CHUNK))
      );
    }
    const imageId = wb.addImage({ base64: btoa(binary), extension: "png" });
    ws.addImage(imageId, {
      tl: { col: 8, row: 0 },
      ext: { width: 90, height: 90 },
    });
    // 36px into column I → 60px in from the sheet's right edge, mirroring the
    // DepEd logo inset; 12.5px down so its centre (57.5) matches the DepEd
    // logo's centre (the two logos then share one horizontal line).
    setImageOffsets(ws, imageId, { x: 36, y: 12.5 });
  } catch {
    // Crest asset unavailable — render the form without it.
  }
}

export async function buildFilledGcForm03Workbook(
  data: GcForm03Data
): Promise<Workbook> {
  const { wb, ws } = await loadGcForm03Template();
  fillGcForm03Sheet(ws, data);
  applyHeaderLayout(ws);
  await stampSchoolCrest(wb, ws);
  return wb;
}

/** Shared export filename: `GCForm-03_<student>_<date>.<extension>`. */
export function gcForm03Filename(
  studentName: string,
  extension: string,
): string {
  const safe =
    (studentName ?? "")
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "referral";
  const date = new Date().toISOString().slice(0, 10);
  return `GCForm-03_${safe}_${date}.${extension}`;
}

function filenameFor(studentName: string): string {
  return gcForm03Filename(studentName, "xlsx");
}

export async function downloadGcForm03(data: GcForm03Data): Promise<void> {
  const wb = await buildFilledGcForm03Workbook(data);
  const out = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filenameFor(data.studentName);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
