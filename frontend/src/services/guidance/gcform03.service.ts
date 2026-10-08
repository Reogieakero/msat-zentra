import type { OcForm01Detail } from "@/components/ocform01/ocform01";
import { TEMPLATE_CONCERN_LABELS } from "./gcform03.types";
import type {
  GcForm03Concerns,
  GcForm03Data,
  GcForm03Source,
  TemplateConcernKey,
} from "./gcform03.types";

export const REFERRAL_DRAFT_KEY = "zentra.adm-referral-recommendation";

const DRAFT_STORE_PREFIX = "zentra.gcform03-fill.v1.";

export function gcForm03DraftKey(referralId: string): string {
  return `${DRAFT_STORE_PREFIX}${referralId}`;
}

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

  }
}

export function clearGcForm03Draft(referralId: string): void {
  try {
    if (typeof window === "undefined" || !referralId) return;
    window.localStorage.removeItem(gcForm03DraftKey(referralId));
  } catch {

  }
}

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

export function consultRecommendation(notes?: string | null): string {
  if (!notes) return "";
  const line = notes
    .split("\n")
    .map((s) => s.trim())
    .find((s) => s.startsWith("[ADM consult]"));
  if (!line) return "";
  return line.replace(/^\[ADM consult\]\s*/, "");
}

export function templateConcernLabel(
  key: TemplateConcernKey,
  checked: boolean
): string {
  const { label, doubleSpace } = TEMPLATE_CONCERN_LABELS[key];
  return `${checked ? "☑" : "☐"}${doubleSpace ? "  " : " "}${label}`;
}

export function templateOthersLabel(checked: boolean): string {
  return `${checked ? "☑" : "☐"} Others:`;
}

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

function today(): string {
  const d = new Date();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

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

    receivedBy: counselorName,
    receivedDate: now,

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
