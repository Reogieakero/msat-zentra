import type { Workbook, Worksheet } from "exceljs";

/**
 * Renders a filled GCForm-03 worksheet to a self-contained HTML string so
 * the preview dialog shows the actual Excel file — every label, merge,
 * font, alignment, border, row height, column width, and the embedded
 * DepEd logo comes straight from the workbook. All styling is inline, so
 * the markup is immune to app CSS and prints exactly as shown.
 */

type StyleRecord = Record<string, unknown>;

function toRecord(value: unknown): StyleRecord {
  return value && typeof value === "object"
    ? (value as StyleRecord)
    : {};
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Office theme slot → screen color (only slots the template uses). */
function themeToCss(theme: unknown): string | null {
  if (theme === 1) return "#000000";
  if (theme === 0) return "#ffffff";
  return null;
}

function colorToCss(color: unknown): string | null {
  const c = toRecord(color);
  if (typeof c.argb === "string" && /^[0-9A-Fa-f]{8}$/.test(c.argb)) {
    return `#${(c.argb as string).slice(2)}`;
  }
  if (typeof c.rgb === "string" && /^[0-9A-Fa-f]{6,8}$/.test(c.rgb)) {
    const rgb = c.rgb as string;
    return `#${rgb.length === 8 ? rgb.slice(2) : rgb}`;
  }
  if ("theme" in c) return themeToCss(c.theme);
  return null;
}

function borderCss(side: unknown): string | null {
  const s = toRecord(side);
  const style = typeof s.style === "string" ? s.style : "";
  if (!style || style === "none") return null;
  const width =
    style === "medium"
      ? "2px"
      : style === "thick"
        ? "3px"
        : "1px";
  const kind =
    style === "double"
      ? "double"
      : style === "dotted"
        ? "dotted"
        : style === "dashed"
          ? "dashed"
          : "solid";
  const color = colorToCss(s.color) ?? "#000000";
  return `${width} ${kind} ${color}`;
}

/** Plain-text content of a cell (checkbox glyphs pass through untouched). */
function cellText(cell: {
  value?: unknown;
}): string {
  const v = cell.value as unknown;
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  if (v instanceof Date) return v.toLocaleDateString("en-US");
  if (typeof v === "object") {
    const o = v as StyleRecord;
    if (Array.isArray(o.richText)) {
      return (o.richText as StyleRecord[])
        .map((t) => String(t.text ?? ""))
        .join("");
    }
    if (typeof o.text === "string") return o.text;
    if (typeof o.result === "string" || typeof o.result === "number") {
      return String(o.result);
    }
    if (typeof o.error === "string") return String(o.error);
  }
  return "";
}

function cellInlineStyle(cell: {
  font?: unknown;
  alignment?: unknown;
  border?: unknown;
  fill?: unknown;
}): string {
  const parts: string[] = [];
  const font = toRecord(cell.font);
  const alignment = toRecord(cell.alignment);
  const border = toRecord(cell.border);
  const fill = toRecord(cell.fill);

  parts.push(
    `font-family:${typeof font.name === "string" ? font.name : "Calibri"},Arial,sans-serif`
  );
  const size = typeof font.size === "number" ? font.size : 11;
  parts.push(`font-size:${size}pt`);
  if (font.bold === true) parts.push("font-weight:700");
  if (font.italic === true) parts.push("font-style:italic");
  if (typeof font.underline === "boolean" && font.underline) {
    parts.push("text-decoration:underline");
  } else if (typeof font.underline === "string" && font.underline) {
    parts.push("text-decoration:underline");
  }
  if (font.strike === true) parts.push("text-decoration:line-through");
  const fontColor = colorToCss(font.color);
  if (fontColor) parts.push(`color:${fontColor}`);

  const h = typeof alignment.horizontal === "string" ? alignment.horizontal : "";
  parts.push(
    `text-align:${h === "center" || h === "centerContinuous" ? "center" : h === "right" ? "right" : h === "justify" ? "justify" : "left"}`
  );
  const vv = typeof alignment.vertical === "string" ? alignment.vertical : "";
  parts.push(
    `vertical-align:${vv === "middle" ? "middle" : vv === "top" ? "top" : "bottom"}`
  );
  if (alignment.wrapText === true) {
    parts.push("white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word");
  } else {
    parts.push("white-space:nowrap");
  }

  const top = borderCss(border.top);
  const right = borderCss(border.right);
  const bottom = borderCss(border.bottom);
  const left = borderCss(border.left);
  if (top) parts.push(`border-top:${top}`);
  if (right) parts.push(`border-right:${right}`);
  if (bottom) parts.push(`border-bottom:${bottom}`);
  if (left) parts.push(`border-left:${left}`);

  if (toRecord(fill).pattern === "solid") {
    const bg = colorToCss(toRecord(fill).fgColor ?? toRecord(fill).bgColor);
    if (bg) parts.push(`background-color:${bg}`);
  }

  parts.push("padding:1px 4px");
  return parts.join(";");
}

function colLetterToNumber(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function colNumberToLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const q = (n - 1) % 26;
    s = String.fromCharCode(65 + q) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** master address → { cols, rows } for every merged range on the sheet. */
function mergeMap(ws: Worksheet): Map<string, { cols: number; rows: number }> {
  const merges = (
    toRecord((ws as unknown as StyleRecord).model).merges as unknown
  ) as string[] | undefined;
  const map = new Map<string, { cols: number; rows: number }>();
  const slaves = new Set<string>();
  for (const m of merges ?? []) {
    const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(m);
    if (!match) continue;
    const c1 = colLetterToNumber(match[1]);
    const r1 = Number(match[2]);
    const c2 = colLetterToNumber(match[3]);
    const r2 = Number(match[4]);
    map.set(`${match[1]}${match[2]}`, { cols: c2 - c1 + 1, rows: r2 - r1 + 1 });
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const addr = `${colNumberToLetter(c)}${r}`;
        if (addr !== `${match[1]}${match[2]}`) slaves.add(addr);
      }
    }
  }
  map.set("__slaves__", { cols: 0, rows: 0 });
  (map as unknown as { slaves: Set<string> }).slaves = slaves;
  return map;
}

function mergeSlaves(map: Map<string, { cols: number; rows: number }>): Set<string> {
  return (map as unknown as { slaves: Set<string> }).slaves ?? new Set<string>();
}

/** Excel column-width units → px (MaximumDigitWidth ≈ 7 + 5 padding). */
function colWidthPx(width: number | undefined): number {
  return Math.max(8, Math.round((width ?? 8.43) * 7 + 5));
}

function u8ToBase64(data: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < data.length; i += CHUNK) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(data.subarray(i, i + CHUNK))
    );
  }
  return btoa(binary);
}

function mimeForExtension(ext: string): string {
  const e = ext.toLowerCase();
  if (e === "png") return "image/png";
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "gif") return "image/gif";
  return "image/png";
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Embedded sheet images (the DepEd logo) as absolutely-positioned <img>. */
function renderImages(
  wb: Workbook,
  ws: Worksheet,
  colPx: number[],
  rowPx: number[]
): string {
  const getImages = (
    ws as unknown as { getImages?: () => StyleRecord[] }
  ).getImages;
  if (typeof getImages !== "function") return "";
  const media = (
    toRecord((wb as unknown as StyleRecord).model).media as unknown
  ) as { buffer?: Uint8Array; extension?: string }[] | undefined;
  if (!media) return "";
  const out: string[] = [];
  for (const img of getImages.call(ws)) {
    const imageId = num(img.imageId, -1);
    const entry = imageId >= 0 ? media[imageId] : undefined;
    if (!entry?.buffer) continue;
    const range = toRecord(img.range);
    const tl = toRecord(range.tl);
    const ext = toRecord(range.ext);
    // Anchor col/row are 0-based in ExcelJS; offsets + ext may be EMU or px.
    const col = num(tl.nativeCol ?? tl.col, 0);
    const row = num(tl.nativeRow ?? tl.row, 0);
    const offXemu = num(tl.nativeColOff ?? tl.colOff, 0);
    const offYemu = num(tl.nativeRowOff ?? tl.rowOff, 0);
    const offX = offXemu > 5000 ? offXemu / 9525 : offXemu;
    const offY = offYemu > 5000 ? offYemu / 9525 : offYemu;
    let left = offX;
    for (let c = 0; c < col && c < colPx.length; c++) left += colPx[c];
    let top = offY;
    for (let r = 0; r < row && r < rowPx.length; r++) top += rowPx[r];
    let w = num(ext.width, 100);
    let h = num(ext.height, 115);
    if (w > 5000) w /= 9525;
    if (h > 5000) h /= 9525;
    const src = `data:${mimeForExtension(String(entry.extension ?? "png"))};base64,${u8ToBase64(entry.buffer)}`;
    out.push(
      `<img src="${src}" alt="" style="position:absolute;left:${Math.round(left)}px;top:${Math.round(top)}px;width:${Math.round(w)}px;height:${Math.round(h)}px;" />`
    );
  }
  return out.join("");
}

/**
 * Render the worksheet (masters only; slaves fold into colspan/rowspan)
 * to an HTML table string. Column widths use the sheet's own proportions
 * so screen and print keep the Excel layout at any container width.
 */
export function renderGcForm03SheetHtml(wb: Workbook): string {
  const ws: Worksheet =
    wb.getWorksheet("Referral Form") ?? wb.worksheets[0];
  if (!ws) throw new Error("The referral template sheet is missing.");

  const rowCount = ws.rowCount || 50;
  const colCount = ws.columnCount || 10;
  const merges = mergeMap(ws);
  const slaves = mergeSlaves(merges);

  const colWidths: number[] = [];
  let totalUnits = 0;
  for (let c = 1; c <= colCount; c++) {
    const w = ws.getColumn(c).width ?? 8.43;
    colWidths.push(w);
    totalUnits += w;
  }
  const rowHeightsPt: number[] = [];
  for (let r = 1; r <= rowCount; r++) {
    rowHeightsPt.push(ws.getRow(r).height ?? 15);
  }
  const rowPx = rowHeightsPt.map((pt) => pt * (96 / 72));
  const colPx = colWidths.map(colWidthPx);

  const cols = colWidths
    .map((w) => `<col style="width:${((w / totalUnits) * 100).toFixed(2)}%" />`)
    .join("");

  const rows: string[] = [];
  for (let r = 1; r <= rowCount; r++) {
    const cells: string[] = [];
    for (let c = 1; c <= colCount; c++) {
      const addr = `${colNumberToLetter(c)}${r}`;
      if (slaves.has(addr)) continue;
      const cell = ws.getCell(addr);
      const span = merges.get(addr);
      const spanAttr =
        (span && span.cols > 1 ? ` colspan="${span.cols}"` : "") +
        (span && span.rows > 1 ? ` rowspan="${span.rows}"` : "");
      const text = escapeHtml(cellText(cell));
      cells.push(`<td${spanAttr} style="${cellInlineStyle(cell)}">${text || ""}</td>`);
    }
    rows.push(
      `<tr style="height:${rowHeightsPt[r - 1]}pt">${cells.join("")}</tr>`
    );
  }

  return (
    `<div class="gcx-sheet" style="position:relative;background:#ffffff;color:#000000;font-family:Calibri,Arial,sans-serif;">` +
    renderImages(wb, ws, colPx, rowPx) +
    `<table class="gcx-table" style="width:100%;border-collapse:collapse;table-layout:fixed;">` +
    `<colgroup>${cols}</colgroup><tbody>${rows.join("")}</tbody></table></div>`
  );
}
