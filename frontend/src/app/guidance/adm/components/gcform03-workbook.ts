import type { Workbook, Worksheet } from "exceljs";
import type { GcForm03Data } from "./gcform03-data";
import {
  splitGcForm03Block,
  templateConcernLabel,
  templateOthersLabel,
} from "./gcform03-data";

/**
 * Fill engine for the official GCForm-03 Referral Form template
 * (`public/referral forms/Referral Form - GCForm-03 v11.xlsx`).
 *
 * The workbook is loaded from the public folder and ONLY answer cells get
 * new values — every font, border, fill, merge, image, print setting, and
 * static label stays exactly as the template ships it. No rebuild, no
 * restyle. Date + received-by answers are always centered in the file.
 *
 * NOTE on ExcelJS style sharing: cells read from a file share their style
 * objects, so per-property setters (`cell.font = …`, `cell.alignment = …`)
 * leak onto every identically-formatted cell. Every style edit here
 * replaces the whole style object (`cell.style = { … }`) which stays
 * local to the addressed cell — verified leak-free by save/reload audit.
 */

const TEMPLATE_URL = encodeURI(
  "/referral forms/Referral Form - GCForm-03 v11.xlsx"
);
const SHEET_NAME = "Referral Form";

type ExcelJSModule = {
  default?: { Workbook: new () => Workbook };
  Workbook: new () => Workbook;
};

async function loadExcelJS(): Promise<{ Workbook: new () => Workbook }> {
  const mod = (await import("exceljs")) as unknown as ExcelJSModule;
  return mod.default ?? mod;
}

/** Write a value without touching fonts/borders/fills/merges. */
function setValue(ws: Worksheet, address: string, value: string): void {
  ws.getCell(address).value = value ?? "";
}

/**
 * Write a paragraph cell and allow wrapping so multi-line answers stay
 * readable. Replaces the whole style object (never mutates the shared one)
 * — fonts, borders, and fills are carried over untouched.
 */
function setPara(ws: Worksheet, address: string, value: string): void {
  const cell = ws.getCell(address);
  cell.value = value ?? "";
  const current = toRecord(cell.alignment);
  cell.style = {
    ...cell.style,
    alignment: { ...current, wrapText: true, vertical: "middle" },
  };
}

/** Center an answer in its placeholder cell (leak-safe full style replace). */
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

/** Grow the last row of a paragraph block so wrapped text stays visible. */
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

/** Load the public-folder template workbook (design as shipped). */
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

/**
 * Fill ONLY the answer cells of a loaded template sheet. Static labels,
 * captions, logos, borders, merges, and print settings are never altered;
 * date + received-by answers are always centered in the file.
 */
export function fillGcForm03Sheet(ws: Worksheet, data: GcForm03Data): void {
  /* ---- Identity (underline inputs; masters of merged ranges) ---- */
  setValue(ws, "C11", data.studentName);
  setValue(ws, "I11", data.gradeSection);

  /* ---- Concerns (flip box/ballot-box, keep every label word as shipped) ---- */
  setValue(ws, "A13", templateConcernLabel("absences", data.concerns.absences));
  setValue(ws, "E13", templateConcernLabel("academic", data.concerns.academic));
  setValue(ws, "H13", templateConcernLabel("personal", data.concerns.personal));
  setValue(ws, "A14", templateConcernLabel("family", data.concerns.family));
  setValue(ws, "E14", templateConcernLabel("peer", data.concerns.peer));
  setValue(ws, "H14", templateOthersLabel(data.concerns.others));
  setValue(ws, "I14", data.concerns.others ? data.concerns.othersText : "");

  /* ---- Details of Concern (full-row block, rows 16-18) ---- */
  const detailsBase = ws.getRow(18).height ?? 26;
  const detailRows = splitGcForm03Block(data.detailsOfConcern, 3, 120);
  setPara(ws, "A16", detailRows[0]);
  setPara(ws, "A17", detailRows[1]);
  setPara(ws, "A18", detailRows[2]);
  fitBlock(ws, 18, detailsBase, detailRows[2], 120);

  /* ---- A. Action/s Taken — 5 fixed numbered rows (B = action, H = date) ---- */
  const actions = [...data.referrerActions].slice(0, 5);
  while (actions.length < 5) actions.push({ date: "", action: "" });
  actions.forEach((row, i) => {
    const excelRow = 20 + i;
    setPara(ws, `B${excelRow}`, row.action);
    setValue(ws, `H${excelRow}`, row.date);
    centerCell(ws, `H${excelRow}`);
  });

  /* ---- B. Recommendations (referrer block, rows 26-27) ---- */
  const recBase = ws.getRow(27).height ?? 28;
  const recRows = splitGcForm03Block(data.referrerRecommendations, 2, 120);
  setPara(ws, "A26", recRows[0]);
  setPara(ws, "A27", recRows[1]);
  fitBlock(ws, 27, recBase, recRows[1], 120);

  /* ---- Referrer signature line (name only; role captions stay as printed) ---- */
  setValue(ws, "F28", data.referredByName);

  /* ---- Received by / Date (always centered in the file) ---- */
  setValue(ws, "C31", data.receivedBy);
  centerCell(ws, "C31");
  setValue(ws, "G31", data.receivedDate);
  centerCell(ws, "G31");

  /* ---- Guidance calls: C = box, D = date, F = subject/time, H = remarks ---- */
  const callRows = [36, 37, 38];
  data.guidanceCalls.slice(0, 3).forEach((call, i) => {
    const r = callRows[i];
    setValue(ws, `C${r}`, call.checked ? "☑" : "☐");
    setValue(ws, `D${r}`, call.date);
    centerCell(ws, `D${r}`);
    setPara(ws, `F${r}`, call.subject);
    setPara(ws, `H${r}`, call.remarks);
  });

  /* ---- Guidance recommendations (C39 + continuation A40/A41) ---- */
  const gRecBase = ws.getRow(41).height ?? 28;
  const gRecRows = splitGcForm03Block(data.guidanceRecommendations, 3, 100);
  setPara(ws, "C39", gRecRows[0]);
  setPara(ws, "A40", gRecRows[1]);
  setPara(ws, "A41", gRecRows[2]);
  fitBlock(ws, 41, gRecBase, gRecRows[2], 100);

  /* ---- Follow up (C42 + continuation A43/A44) ---- */
  const followBase = ws.getRow(44).height ?? 28;
  const followRows = splitGcForm03Block(data.followUp, 3, 100);
  setPara(ws, "C42", followRows[0]);
  setPara(ws, "A43", followRows[1]);
  setPara(ws, "A44", followRows[2]);
  fitBlock(ws, 44, followBase, followRows[2], 100);

  /* ---- Counselor sign-off (date always centered in the file) ---- */
  setValue(ws, "A46", data.counselorName);
  setValue(ws, "G46", data.counselorDate);
  centerCell(ws, "G46");
}

/** Load the template, fill it, and return the filled workbook. */
export async function buildFilledGcForm03Workbook(
  data: GcForm03Data
): Promise<Workbook> {
  const { wb, ws } = await loadGcForm03Template();
  fillGcForm03Sheet(ws, data);
  return wb;
}

function filenameFor(studentName: string): string {
  const safe =
    (studentName ?? "")
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "referral";
  const date = new Date().toISOString().slice(0, 10);
  return `GCForm-03_${safe}_${date}.xlsx`;
}

/**
 * Load the public-folder template, fill ONLY the answer cells from the
 * referral form data, and download the result. The template design
 * (labels, captions, logos, borders, merges, print area) is never altered.
 */
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
