import type { OcForm01Detail } from "@/components/ocform01/ocform01";

/* Minimal case fields the GCForm-03 builder reads — satisfied by ADM cases
   and desk referral rows alike, so previews can build from either. */
export interface GcForm03Source {
  student: string;
  grade: string;
  section: string;
  category?: string;
  anecdotalExcerpt?: string;
  reason: string;
  recommendations?: string;
  referredBy: string;
  date: string;
}

/**
 * GCForm-03 Referral Form data (template: public/referral forms/).
 * Built live — identity, filing, and recommendation fields auto-populate from
 * the case + its official anecdotal report; the counselor answers the rest.
 */

export const REFERRAL_DRAFT_KEY = "zentra.adm-referral-recommendation";

/* Persistent in-progress fill for the referral page: one localStorage entry
   per referral so a refresh / accidental navigation never wipes the
   counselor's answers. Versioned prefix — bump when GcForm03Data changes
   shape so stale saves stop matching instead of half-loading. */
const DRAFT_STORE_PREFIX = "zentra.gcform03-fill.v1.";

export function gcForm03DraftKey(referralId: string): string {
  return `${DRAFT_STORE_PREFIX}${referralId}`;
}

/** Previously saved fill for one referral, or null when absent/unreadable. */
export function loadGcForm03Draft(referralId: string): unknown {
  try {
    if (typeof window === "undefined" || !referralId) return null;
    const raw = window.localStorage.getItem(gcForm03DraftKey(referralId));
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function saveGcForm03Draft(referralId: string, data: GcForm03Data): void {
  try {
    if (typeof window === "undefined" || !referralId) return;
    window.localStorage.setItem(gcForm03DraftKey(referralId), JSON.stringify(data));
  } catch {
    /* Storage full or blocked — the form keeps working in memory. */
  }
}

export function clearGcForm03Draft(referralId: string): void {
  try {
    if (typeof window === "undefined" || !referralId) return;
    window.localStorage.removeItem(gcForm03DraftKey(referralId));
  } catch {
    /* Ignore — nothing to clean. */
  }
}

/**
 * Merge a stored draft over freshly built data. Stored answers always win,
 * but every field falls back to the live build — so a save from an older
 * form shape still yields a complete, submittable form.
 */
export function sanitizeGcForm03Draft(raw: unknown, fallback: GcForm03Data): GcForm03Data {
  if (!raw || typeof raw !== "object") return fallback;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, fb: string): string =>
    typeof v === "string" ? v : fb;
  const obj = (v: unknown): Record<string, unknown> =>
    typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
  const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null;
  const concernsRaw = obj(r.concerns);
  const actionsRaw = Array.isArray(r.referrerActions)
    ? (r.referrerActions as unknown[])
    : [];
  const callsRaw = Array.isArray(r.guidanceCalls)
    ? (r.guidanceCalls as unknown[])
    : [];
  const actions = actionsRaw.slice(0, 5).map((a) => {
    const o = obj(a);
    return { date: str(o.date, ""), action: str(o.action, "") };
  });
  const callLabels = ["1st", "2nd", "3rd"];
  return {
    ...fallback,
    studentName: str(r.studentName, fallback.studentName),
    gradeSection: str(r.gradeSection, fallback.gradeSection),
    concerns: isObj(r.concerns)
      ? {
          absences: concernsRaw.absences === true,
          academic: concernsRaw.academic === true,
          personal: concernsRaw.personal === true,
          family: concernsRaw.family === true,
          peer: concernsRaw.peer === true,
          others: concernsRaw.others === true,
          othersText: str(concernsRaw.othersText, ""),
        }
      : fallback.concerns,
    detailsOfConcern: str(r.detailsOfConcern, fallback.detailsOfConcern),
    referrerActions: actions.length > 0 ? actions : fallback.referrerActions,
    referrerRecommendations: str(
      r.referrerRecommendations,
      fallback.referrerRecommendations
    ),
    referredByName: str(r.referredByName, fallback.referredByName),
    referredByRole: str(r.referredByRole, fallback.referredByRole),
    referredDate: str(r.referredDate, fallback.referredDate),
    receivedBy: str(r.receivedBy, fallback.receivedBy),
    receivedDate: str(r.receivedDate, fallback.receivedDate),
    guidanceCalls: callLabels.map((label, i) => {
      const o = obj(callsRaw[i]);
      const fb = fallback.guidanceCalls[i];
      return {
        call: label,
        checked: o.checked === true,
        date: str(o.date, fb?.date ?? ""),
        subject: str(o.subject, fb?.subject ?? ""),
        remarks: str(o.remarks, fb?.remarks ?? ""),
      };
    }),
    guidanceRecommendations: str(
      r.guidanceRecommendations,
      fallback.guidanceRecommendations
    ),
    followUp: str(r.followUp, fallback.followUp),
    counselorName: str(r.counselorName, fallback.counselorName),
    counselorDate: str(r.counselorDate, fallback.counselorDate),
  };
}

/* Review recommendation stored on the referral by the ADM consultation
   review (`[ADM consult] ...` appended to notes) — reused as the GCForm-03
   guidance-recommendations line when viewing the passed-on form. */
export function consultRecommendation(notes?: string | null): string {
  if (!notes) return "";
  const line = notes
    .split("\n")
    .map((s) => s.trim())
    .find((s) => s.startsWith("[ADM consult]"));
  if (!line) return "";
  return line.replace(/^\[ADM consult\]\s*/, "");
}

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
  row: GcForm03Source,
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
