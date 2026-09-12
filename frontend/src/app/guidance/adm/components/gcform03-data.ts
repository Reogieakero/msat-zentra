import type { OcForm01Detail } from "@/components/ocform01/ocform01";
import type { GuidanceAdmCase } from "./guidance-adm-data";

/**
 * GCForm-03 Referral Form data (template: public/referral forms/).
 * Built live — identity, filing, and recommendation fields auto-populate from
 * the case + its official anecdotal report; the counselor answers the rest.
 */

export const REFERRAL_DRAFT_KEY = "zentra.adm-referral-recommendation";

export interface GcForm03ActionRow {
  date: string;
  action: string;
}

/* One call row of the template's guidance table: checkable, each with its
   own date, subject/time, and remarks. Template fixes these at 3 rows. */
export interface GcForm03CallRow {
  call: string;
  checked: boolean;
  date: string;
  subject: string;
  remarks: string;
}

export interface GcForm03Concerns {
  absences: boolean;
  academic: boolean;
  personal: boolean;
  family: boolean;
  peer: boolean;
  others: boolean;
  othersText: string;
}

export interface GcForm03Data {
  studentName: string;
  gradeSection: string;
  concerns: GcForm03Concerns;
  detailsOfConcern: string;
  referrerActions: GcForm03ActionRow[];
  referrerRecommendations: string;
  referredByName: string;
  referredByRole: string;
  referredDate: string;
  receivedBy: string;
  receivedDate: string;
  guidanceCalls: GcForm03CallRow[];
  guidanceRecommendations: string;
  followUp: string;
  counselorName: string;
  counselorDate: string;
}

export const CONCERN_OPTIONS: { key: keyof Omit<GcForm03Concerns, "othersText">; label: string }[] = [
  { key: "absences", label: "Absences / Tardiness / Cutting classes" },
  { key: "academic", label: "Academic Problems" },
  { key: "personal", label: "Personal Problems" },
  { key: "family", label: "Family Problems" },
  { key: "peer", label: "Peer Problems" },
  { key: "others", label: "Others" },
];

/**
 * Concern labels EXACTLY as printed in the official template
 * (`public/referral forms/Referral Form - GCForm-03 v11.xlsx`, rows 13-14).
 * The on-screen question form above may use friendlier wording, but both
 * the modal preview and the .xlsx fill must use these so the two outputs
 * match the template — and each other — word for word.
 */
export const TEMPLATE_CONCERN_LABELS = {
  absences: { label: "Absences/Tardiness/Cutting classes", doubleSpace: true },
  academic: { label: "Academic Problems", doubleSpace: true },
  personal: { label: "Personal Problems", doubleSpace: true },
  family: { label: "Family Problems", doubleSpace: false },
  peer: { label: "Peer Problems", doubleSpace: false },
} as const;

export type TemplateConcernKey = keyof typeof TEMPLATE_CONCERN_LABELS;

/** `☐  Absences/...` → `☑  Absences/...`: only the box flips, never the words. */
export function templateConcernLabel(
  key: TemplateConcernKey,
  checked: boolean
): string {
  const { label, doubleSpace } = TEMPLATE_CONCERN_LABELS[key];
  return `${checked ? "☑" : "☐"}${doubleSpace ? "  " : " "}${label}`;
}

/** `☐ Others:` → `☑ Others:`: only the box flips, never the words. */
export function templateOthersLabel(checked: boolean): string {
  return `${checked ? "☑" : "☐"} Others:`;
}

/**
 * Split a paragraph across the template's fixed ruled rows (e.g. Details of
 * Concern → rows 16-18). Word-aware, honors the author's line breaks, and
 * folds overflow into the last row. Shared by the modal preview and the
 * .xlsx filler so both show the identical line distribution.
 */
export function splitGcForm03Block(
  text: string,
  maxRows: number,
  perRow: number
): string[] {
  const clean = (text ?? "").replace(/\r\n/g, "\n");
  if (!clean.trim()) return Array<string>(maxRows).fill("");
  const rows: string[] = [];
  for (const line of clean.split("\n")) {
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      rows.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > perRow && current) {
        rows.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    rows.push(current);
  }
  if (rows.length <= maxRows) {
    while (rows.length < maxRows) rows.push("");
    return rows;
  }
  const head = rows.slice(0, maxRows - 1);
  head.push(rows.slice(maxRows - 1).join("\n"));
  return head;
}

export const REFERRER_ROLES = [
  "School Nurse",
  "Prefect of Discipline",
  "Teacher",
  "Adviser",
];

function today(): string {
  const d = new Date();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/* Anecdotal category → GCForm-03 concern checkbox. Exact matches check the
   box; anything else lands in Others with the category as text. */
function concernsFor(category: string | undefined): GcForm03Concerns {
  const base: GcForm03Concerns = {
    absences: false,
    academic: false,
    personal: false,
    family: false,
    peer: false,
    others: false,
    othersText: "",
  };
  switch ((category ?? "").toLowerCase()) {
    case "attendance":
      return { ...base, absences: true };
    case "academic":
      return { ...base, academic: true };
    case "bullying":
      return { ...base, peer: true };
    default:
      return category
        ? { ...base, others: true, othersText: category }
        : base;
  }
}

export function buildGcForm03Data(
  row: GuidanceAdmCase,
  report: OcForm01Detail | null,
  recommendation: string,
  counselorName = ""
): GcForm03Data {
  const now = today();
  /* Details of Concern carries the incident write-up only — the template
     has no location line, so no "Where it happened" suffix is appended. */
  const details =
    report?.descriptionOfIncident ?? row.anecdotalExcerpt ?? row.reason ?? "";
  return {
    studentName: report?.studentName || row.student,
    gradeSection:
      report?.gradeSection ||
      `${row.grade}${row.section && row.section !== "—" ? ` - ${row.section}` : ""}`,
    concerns: concernsFor(row.category),
    detailsOfConcern: details,
    referrerActions: [
      { date: "", action: "" },
      { date: "", action: "" },
      { date: "", action: "" },
    ],
    referrerRecommendations:
      report?.notesRecommendationsActions ?? row.recommendations ?? "",
    referredByName: report?.adviserName ?? row.referredBy,
    referredByRole: "Adviser",
    referredDate: report?.observationDate ?? row.date,
    /* Received-by stays blank until the counselor signs — never a
       placeholder sentence, so the preview/.xlsx line stays empty. */
    receivedBy: counselorName,
    receivedDate: now,
    /* Guidance call rows start unchecked with blank dates — a date is only
       an appropriate value once the counselor checks that call. */
    guidanceCalls: [
      { call: "1st", checked: false, date: "", subject: "", remarks: "" },
      { call: "2nd", checked: false, date: "", subject: "", remarks: "" },
      { call: "3rd", checked: false, date: "", subject: "", remarks: "" },
    ],
    guidanceRecommendations: recommendation,
    followUp: "",
    counselorName,
    counselorDate: now,
  };
}
