import type { AuditLog, User } from "../../generated/prisma/client.js";
import { resolveSourceLabels } from "../../modules/audit/audit.repository.js";

type ExcelJSModule = typeof import("exceljs");

type ExportRow = AuditLog & {
  user: Pick<User, "email" | "role"> | null;
};

export interface AuditExportFilters {
  actionType?: string;
  actorRole?: string;
  sourceTable?: string;
  userId?: string;
  q?: string;
  from?: string;
  to?: string;
}

const FONT = "Calibri";
const INK = "FF1E293B";
const INK_SOFT = "FF64748B";
const HEADER_BG = "FF1E293B";
const ACCENT = "FFB45309";
const ZEBRA = "FFF8FAFC";
const BORDER = "FFE2E8F0";
const WHITE = "FFFFFFFF";

const ACTION_LABELS: Record<string, string> = {
  sf10_update: "SF10 update",
  grade_lock: "Grade lock",
  grade_unlock: "Grade unlock",
  anecdotal_edit: "Anecdotal edit",
  health_record_edit: "Health record edit",
  home_visitation_edit: "Home visitation edit",
  adm_edit: "ADM edit",
  referral_status_change: "Referral status change",
  intervention_approval: "Intervention approval",
  account_approval: "Account approval",
  role_change: "Role change",
  adm_principal_approve: "ADM final sign",
  school_year_create: "School year create",
  term_create: "Term create",
  school_year_set_active: "Set active year",
  school_year_edit: "School year edit",
  honor_roll_mark_awarded: "Honor roll awarded",
  report_refresh: "Report refresh",
  principal_profile_change: "Profile change",
  principal_password_change: "Password change",
};

const ROLE_LABELS: Record<string, string> = {
  principal: "Principal",
  subject_teacher: "Subject Teacher",
  adviser: "Adviser",
  guidance_counselor: "Guidance Counselor",
  nurse: "School Nurse",
  adm_coordinator: "ADM Coordinator",
  record_keeper: "Record Keeper",
  registrar: "Registrar",
  student: "Student",
  parent: "Parent",
  system: "System",
};

const FIELD_LABELS: Record<string, string> = {
  lock_status: "Grade lock",
  locked_by: "Locked by",
  status: "Status",
  eligibility_status: "Eligibility",
  approval_status: "Approval",
  outcome_status: "Outcome",
  approved_by: "Approved by",
  approval_date: "Approval date",
  current_version: "Version",
  validated_by: "Validated by",
  treatment_given: "Treatment given",
  diagnosis: "Diagnosis",
  notes_recommendations_actions: "Notes & recommendations",
  certification_by: "Certified by",
  attended: "Attendance marked",
  awarded: "Awarded",
  is_active: "Active school year",
  contact_number: "Contact number",
  reason: "Reason",
  certification_details: "Certification details",
  generated_at: "Generated at",
  referred_by: "Referred by",
  risk_level_at_flag: "Risk level at flag",
  recommended_action: "Recommended action",
  approved_action: "Approved action",
  outcome_notes: "Outcome notes",
};

const VALUE_LABELS: Record<string, string> = {
  unlocked: "Unlocked",
  locked: "Locked",
  pending: "Pending",
  active: "Active",
  suspended: "Suspended",
  eligible: "Eligible",
  ineligible: "Not eligible",
  approved: "Approved",
  rejected: "Rejected",
  modified: "Modified",
  in_progress: "In progress",
  resolved: "Resolved",
  unresolved: "Unresolved",
  ongoing: "Ongoing",
  true: "Yes",
  false: "No",
};

function titleCase(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function prettyValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  const str = String(value);
  return VALUE_LABELS[str] ?? str;
}

/** "Status: Pending → Approved; Grade lock: Unlocked → Locked" */
function changeSummary(row: ExportRow): string {
  const oldV = (row.oldValue as Record<string, unknown> | null) ?? {};
  const newV = (row.newValue as Record<string, unknown> | null) ?? {};
  const keys = Array.from(new Set([...Object.keys(oldV), ...Object.keys(newV)]));
  const parts: string[] = [];
  for (const key of keys) {
    const from = prettyValue(oldV[key]);
    const to = prettyValue(newV[key]);
    if (from === to) continue;
    parts.push(`${titleCase(key)}: ${from} → ${to}`);
  }
  return parts.join("; ");
}

function buildFilterLines(filters: AuditExportFilters): string[] {
  const lines: string[] = [];
  if (filters.actionType) {
    lines.push(`Action: ${ACTION_LABELS[filters.actionType] ?? filters.actionType}`);
  }
  if (filters.actorRole) {
    lines.push(`Role: ${ROLE_LABELS[filters.actorRole] ?? filters.actorRole}`);
  }
  if (filters.sourceTable) lines.push(`Source table: ${filters.sourceTable}`);
  if (filters.userId) lines.push(`Actor ID: ${filters.userId}`);
  if (filters.from) lines.push(`From: ${filters.from}`);
  if (filters.to) lines.push(`To: ${filters.to}`);
  if (filters.q) lines.push(`Search: “${filters.q}”`);
  return lines;
}

function countBy(
  rows: ExportRow[],
  keyOf: (row: ExportRow) => string,
): { key: string; count: number }[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = keyOf(row) || "—";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/**
 * Builds the principal-facing audit workbook. The log sheet is a frozen,
 * filterable ledger; the summary sheet answers "who / what / where" at a
 * glance; the notes sheet documents the export's provenance.
 */
export async function buildAuditWorkbook(
  rows: ExportRow[],
  filters: AuditExportFilters,
  meta: { generatedByEmail: string; generatedAt: Date },
): Promise<import("exceljs").Workbook> {
  const imported = (await import("exceljs")) as unknown as ExcelJSModule & {
    default?: ExcelJSModule;
  };
  const ExcelJS: ExcelJSModule = imported.default ?? imported;

  const wb = new ExcelJS.Workbook();
  wb.creator = "E-Zentra (MSAT)";
  wb.lastModifiedBy = meta.generatedByEmail;
  wb.created = meta.generatedAt;
  wb.modified = meta.generatedAt;
  wb.title = "MSAT Audit Log";

  const labelMap = await resolveSourceLabels(
    rows.map((r) => ({ sourceTable: r.sourceTable, sourceId: r.sourceId })),
  );

  const thin = { style: "thin" as const, color: { argb: BORDER } };

  const log = wb.addWorksheet("Audit Log", {
    views: [{ state: "frozen", ySplit: 7, xSplit: 1 }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: "7:7",
    },
  });
  log.pageSetup.margins = { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 };

  const widths = [5, 20, 30, 18, 26, 24, 32, 26, 48, 52];
  widths.forEach((w, i) => {
    log.getColumn(i + 1).width = w;
  });

  const lastCol = "J";

  // ---- Title block -------------------------------------------------------
  log.mergeCells(`A1:${lastCol}1`);
  const brand = log.getCell("A1");
  brand.value = "MATI SCHOOL OF ARTS AND TRADES";
  brand.font = { name: FONT, size: 16, bold: true, color: { argb: WHITE } };
  brand.alignment = { horizontal: "center", vertical: "middle" };
  brand.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
  log.getRow(1).height = 30;

  log.mergeCells(`A2:${lastCol}2`);
  const subtitle = log.getCell("A2");
  subtitle.value = "AUDIT LOG — IMMUTABLE ACTIVITY RECORD";
  subtitle.font = { name: FONT, size: 11, bold: true, color: { argb: ACCENT } };
  subtitle.alignment = { horizontal: "center", vertical: "middle" };
  log.getRow(2).height = 18;

  const filterLines = buildFilterLines(filters);
  log.mergeCells(`A3:${lastCol}3`);
  const metaCell = log.getCell("A3");
  metaCell.value = `Generated ${meta.generatedAt.toISOString().replace("T", " ").slice(0, 19)} UTC  •  ${
    rows.length
  } entr${rows.length === 1 ? "y" : "ies"}  •  Generated by ${meta.generatedByEmail}`;
  metaCell.font = { name: FONT, size: 9, color: { argb: INK_SOFT } };
  metaCell.alignment = { horizontal: "center", vertical: "middle" };
  log.getRow(3).height = 16;

  log.mergeCells(`A4:${lastCol}4`);
  const filterCell = log.getCell("A4");
  filterCell.value = filterLines.length
    ? `Filters — ${filterLines.join("  •  ")}`
    : "Filters — none (full audit log)";
  filterCell.font = { name: FONT, size: 9, italic: true, color: { argb: INK_SOFT } };
  filterCell.alignment = { horizontal: "left", vertical: "middle" };
  filterCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };

  log.mergeCells(`A5:${lastCol}5`);
  const noteCell = log.getCell("A5");
  noteCell.value =
    "Entries are append-only. Any edit or deletion is impossible by design; this export is a point-in-time snapshot.";
  noteCell.font = { name: FONT, size: 9, italic: true, color: { argb: INK_SOFT } };
  noteCell.alignment = { horizontal: "left", vertical: "middle" };

  // ---- Table header ------------------------------------------------------
  const headers = [
    "#",
    "Timestamp (UTC)",
    "Actor",
    "Role",
    "Action",
    "Source table",
    "Related record",
    "Source ID",
    "Reason",
    "Changes",
  ];
  const headerRow = log.getRow(7);
  headers.forEach((text, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = text;
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
    cell.alignment = {
      horizontal: i === 0 ? "center" : "left",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = { top: thin, left: thin, bottom: thin, right: thin };
  });
  headerRow.height = 26;

  // ---- Data rows ---------------------------------------------------------
  rows.forEach((row, index) => {
    const excelRow = log.getRow(8 + index);
    const sourceLabel =
      labelMap.get(`${row.sourceTable.toLowerCase()}::${row.sourceId}`) ??
      `${row.sourceTable} #${row.sourceId}`;
    const values: (string | number | Date)[] = [
      index + 1,
      row.createdAt,
      row.user?.email ?? "system",
      ROLE_LABELS[row.user?.role ?? "system"] ?? row.user?.role ?? "System",
      ACTION_LABELS[row.actionType] ?? titleCase(row.actionType),
      row.sourceTable,
      sourceLabel,
      row.sourceId,
      row.reason || "—",
      changeSummary(row) || "—",
    ];

    values.forEach((value, i) => {
      const cell = excelRow.getCell(i + 1);
      cell.value = value;
      cell.font = { name: FONT, size: 9, color: { argb: INK } };
      cell.alignment = {
        horizontal: i === 0 ? "center" : "left",
        vertical: "top",
        wrapText: i === 6 || i === 8 || i === 9,
      };
      cell.border = { top: thin, left: thin, bottom: thin, right: thin };
      if (i === 1) cell.numFmt = "yyyy-mm-dd hh:mm:ss";
      if (index % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
      }
    });
    excelRow.height = 24;
  });

  const lastDataRow = 7 + Math.max(rows.length, 1);
  log.autoFilter = { from: { row: 7, column: 1 }, to: { row: lastDataRow, column: 10 } };

  if (rows.length === 0) {
    log.mergeCells(`A8:${lastCol}8`);
    const empty = log.getCell("A8");
    empty.value = "No audit entries matched the selected filters.";
    empty.font = { name: FONT, size: 10, italic: true, color: { argb: INK_SOFT } };
    empty.alignment = { horizontal: "center", vertical: "middle" };
    log.getRow(8).height = 26;
  }

  // ---- Summary sheet -----------------------------------------------------
  const summary = wb.addWorksheet("Summary", {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "portrait", paperSize: 9, fitToPage: true, fitToWidth: 1 },
  });
  summary.getColumn(1).width = 42;
  summary.getColumn(2).width = 14;
  summary.getColumn(3).width = 14;

  summary.mergeCells("A1:C1");
  const sumTitle = summary.getCell("A1");
  sumTitle.value = "AUDIT LOG SUMMARY";
  sumTitle.font = { name: FONT, size: 15, bold: true, color: { argb: WHITE } };
  sumTitle.alignment = { horizontal: "center", vertical: "middle" };
  sumTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
  summary.getRow(1).height = 28;

  summary.getCell("A3").value = "Total entries";
  summary.getCell("B3").value = rows.length;
  summary.getCell("A4").value = "Oldest entry";
  summary.getCell("B4").value = rows.length
    ? new Date(Math.min(...rows.map((r) => r.createdAt.getTime())))
    : "—";
  summary.getCell("B4").numFmt = "yyyy-mm-dd hh:mm:ss";
  summary.getCell("A5").value = "Newest entry";
  summary.getCell("B5").value = rows.length
    ? new Date(Math.max(...rows.map((r) => r.createdAt.getTime())))
    : "—";
  summary.getCell("B5").numFmt = "yyyy-mm-dd hh:mm:ss";
  summary.getCell("A6").value = "Generated";
  summary.getCell("B6").value = meta.generatedAt;
  summary.getCell("B6").numFmt = "yyyy-mm-dd hh:mm:ss";
  summary.getCell("A7").value = "Generated by";
  summary.getCell("B7").value = meta.generatedByEmail;
  for (let r = 3; r <= 7; r++) {
    summary.getCell(`A${r}`).font = { name: FONT, size: 10, bold: true, color: { argb: INK } };
    summary.getCell(`B${r}`).font = { name: FONT, size: 10, color: { argb: INK } };
    summary.getCell(`A${r}`).border = { bottom: thin };
    summary.getCell(`B${r}`).border = { bottom: thin };
  }

  let anchor = 9;

  const writeBreakdown = (
    title: string,
    data: { key: string; count: number }[],
  ) => {
    summary.mergeCells(`A${anchor}:C${anchor}`);
    const heading = summary.getCell(`A${anchor}`);
    heading.value = title;
    heading.font = { name: FONT, size: 11, bold: true, color: { argb: WHITE } };
    heading.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT } };
    heading.alignment = { vertical: "middle" };
    summary.getRow(anchor).height = 22;
    anchor += 1;

    const head = ["Value", "Entries", "Share"];
    head.forEach((text, i) => {
      const cell = summary.getRow(anchor).getCell(i + 1);
      cell.value = text;
      cell.font = { name: FONT, size: 10, bold: true, color: { argb: INK } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
      cell.border = { top: thin, bottom: thin, left: thin, right: thin };
      cell.alignment = { horizontal: i === 0 ? "left" : "center" };
    });
    anchor += 1;

    for (const item of data) {
      const row = summary.getRow(anchor);
      row.getCell(1).value = item.key;
      row.getCell(2).value = item.count;
      row.getCell(3).value = rows.length ? item.count / rows.length : 0;
      row.getCell(3).numFmt = "0.0%";
      for (let c = 1; c <= 3; c++) {
        const cell = row.getCell(c);
        cell.font = { name: FONT, size: 10, color: { argb: INK } };
        cell.border = { top: thin, bottom: thin, left: thin, right: thin };
        cell.alignment = { horizontal: c === 1 ? "left" : "center" };
      }
      anchor += 1;
    }

    if (data.length === 0) {
      const row = summary.getRow(anchor);
      row.getCell(1).value = "No entries";
      row.getCell(1).font = { name: FONT, size: 10, italic: true, color: { argb: INK_SOFT } };
      anchor += 1;
    }
    anchor += 1;
  };

  writeBreakdown(
    "Activity by action",
    countBy(rows, (r) => ACTION_LABELS[r.actionType] ?? titleCase(r.actionType)),
  );
  writeBreakdown(
    "Activity by role",
    countBy(rows, (r) => ROLE_LABELS[r.user?.role ?? "system"] ?? r.user?.role ?? "System"),
  );
  writeBreakdown(
    "Activity by source table",
    countBy(rows, (r) => r.sourceTable),
  );
  writeBreakdown(
    "Most active actors",
    countBy(rows, (r) => r.user?.email ?? "system"),
  );

  // ---- Notes sheet -------------------------------------------------------
  const notes = wb.addWorksheet("Notes", { views: [{ showGridLines: false }] });
  notes.getColumn(1).width = 30;
  notes.getColumn(2).width = 70;

  notes.mergeCells("A1:B1");
  const notesTitle = notes.getCell("A1");
  notesTitle.value = "EXPORT NOTES";
  notesTitle.font = { name: FONT, size: 13, bold: true, color: { argb: WHITE } };
  notesTitle.alignment = { horizontal: "center", vertical: "middle" };
  notesTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
  notes.getRow(1).height = 26;

  const noteRows: [string, string][] = [
    ["School", "Mati School of Arts and Trades"],
    ["Report", "Audit Log"],
    ["Generated (UTC)", meta.generatedAt.toISOString()],
    ["Generated by", meta.generatedByEmail],
    ["Entries", String(rows.length)],
    ["Filters", filterLines.length ? filterLines.join("; ") : "None (full audit log)"],
    [
      "Integrity",
      "The audit log is append-only. Entries cannot be edited or deleted; this workbook is a point-in-time snapshot.",
    ],
    [
      "Columns",
      "Actor = account that performed the action. Related record = human-readable target resolved from the source table.",
    ],
    [
      "Changes",
      "Renders each field difference as “Field: old → new”. Missing values show as —.",
    ],
  ];
  noteRows.forEach(([label, value], i) => {
    const row = notes.getRow(i + 3);
    row.getCell(1).value = label;
    row.getCell(1).font = { name: FONT, size: 10, bold: true, color: { argb: INK } };
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    row.getCell(2).value = value;
    row.getCell(2).font = { name: FONT, size: 10, color: { argb: INK } };
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
    for (let c = 1; c <= 2; c++) {
      row.getCell(c).border = { top: thin, bottom: thin, left: thin, right: thin };
    }
    row.height = 22;
  });

  return wb;
}

/** Timestamped, filesystem-safe filename for the audit export. */
export function auditExportFilename(generatedAt: Date): string {
  const stamp = generatedAt.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `MSAT-audit-log-${stamp}.xlsx`;
}
