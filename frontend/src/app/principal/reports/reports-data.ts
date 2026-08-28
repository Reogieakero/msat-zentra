// Types and UI registry for the Principal Reports & Analytics command center.
// All values are fetched live from GET /api/reports (see backend
// modules/reports). No mock data.

export type ReportType = "trends" | "intervention_success" | "heat_map" | "honor_roll";
export type ReportScope = "school" | "grade" | "section";

export const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: "trends", label: "Performance Trends" },
  { value: "intervention_success", label: "Intervention Success" },
  { value: "heat_map", label: "Risk Heat Map" },
  { value: "honor_roll", label: "Honor Roll" },
];

export const SCOPES: { value: ReportScope; label: string }[] = [
  { value: "school", label: "School" },
  { value: "grade", label: "Grade" },
  { value: "section", label: "Section" },
];

export const TERMS = ["Term 1 · SY 2026–2027", "Term 2 · SY 2026–2027", "Term 3 · SY 2026–2027"];

export type ReportKpis = {
  avgTransmuted: number;
  interventionsResolved: number;
  interventionRate: number;
  sectionsAtRisk: number;
  honorRoll: number;
};

export type ReportsPayload = {
  termLabel: string;
  schoolYear: string;
  kpis: ReportKpis;
  trends: { term: string; avgTransmuted: number }[];
  interventionSuccess: {
    grade: string;
    referred: number;
    resolved: number;
    ongoing: number;
  }[];
  honorRollByGrade: { grade: string; candidates: number }[];
  admStages: { stage: string; count: number }[];
  admEligibility: { status: string; count: number }[];
  riskDistribution: { level: string; count: number }[];
  attendanceWatch: { section: string; rate: number }[];
  auditActivity: { action: string; count: number }[];
  anecdotalCategories: { category: string; count: number }[];
  accountApprovals: { band: string; pending: number }[];
};

export const HEATMAP_FACTORS = ["Academic", "Attendance", "Behavioral"] as const;
export type HeatmapFactor = (typeof HEATMAP_FACTORS)[number];

export function heatmapCellColor(count: number): string {
  if (count <= 0) return "var(--hm-0)";
  if (count <= 3) return "var(--hm-1)";
  if (count <= 7) return "var(--hm-2)";
  if (count <= 11) return "var(--hm-3)";
  return "var(--hm-4)";
}

export const HEATMAP_SCALE = [
  "var(--hm-0)",
  "var(--hm-1)",
  "var(--hm-2)",
  "var(--hm-3)",
  "var(--hm-4)",
];

/* ---- Command-center panel registry ---- */
export type PanelId =
  | "trends"
  | "honor_roll"
  | "adm_stages"
  | "adm_eligibility"
  | "risk_distribution"
  | "intervention"
  | "attendance_watch"
  | "audit"
  | "anecdotal"
  | "accounts";

export type PanelDef = {
  id: PanelId;
  title: string;
  hint: string;
  kind: "line" | "bar" | "stat" | "list" | "cards";
  /** column width within its row: 1 = single, 2 = double, 3 = full width */
  cols: 1 | 2 | 3;
};

export type PanelRow = PanelDef[];

/* Explicit row framing. Each inner array is one horizontal row; the `cols`
 * values sum to the row's column count (e.g. [2,1] = one wide + one narrow,
 * [1,1,1] = three equal). */
export const PANEL_ROWS: PanelRow[] = [
  [
    { id: "trends", title: "Performance Trends", hint: "Avg transmuted grade by term", kind: "line", cols: 2 },
    { id: "honor_roll", title: "Honor Roll by Grade", hint: "O5 candidates per level", kind: "bar", cols: 1 },
  ],
  [
    { id: "attendance_watch", title: "Attendance Watch", hint: "Sections below 80%", kind: "bar", cols: 1 },
    { id: "adm_eligibility", title: "ADM Eligibility", hint: "Status breakdown", kind: "stat", cols: 1 },
    { id: "risk_distribution", title: "Risk Distribution", hint: "High / Moderate / Low", kind: "stat", cols: 1 },
  ],
  [
    { id: "intervention", title: "Intervention Outcomes", hint: "Resolved vs ongoing", kind: "bar", cols: 2 },
    { id: "anecdotal", title: "Anecdotal Volume", hint: "By category", kind: "bar", cols: 1 },
  ],
  [
    { id: "accounts", title: "Account Approvals", hint: "Pending by grade band", kind: "stat", cols: 2 },
    { id: "audit", title: "Audit Activity", hint: "Events by action type", kind: "bar", cols: 1 },
  ],
  [
    { id: "adm_stages", title: "ADM Pipeline", hint: "Cases by stage", kind: "list", cols: 3 },
  ],
];
