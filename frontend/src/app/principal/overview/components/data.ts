import type { ComponentType } from "react";

export type AnecdotalCategory = {
  key: string;
  label: string;
  value: number;
  color: string;
};

export type AnecdotalSummary = {
  categories: AnecdotalCategory[];
  total: number;
  students: AnecdotalStudent[];
};

export type AnecdotalStudent = {
  id: string;
  lrn: string;
  section: string;
  year: string;
  dateAdded: string;
  adviser: string;
};

export type AttendancePoint = {
  day: string;
  present: number;
  total: number;
};

export type AttendanceSummary = {
  trend: AttendancePoint[];
  grades: GradeAttendance[];
};

export type GradeAttendance = {
  grade: string;
  present: number;
  total: number;
  days: AttendancePoint[];
};

export type AdmDocument = {
  id: string;
  lrn: string;
  student: string;
  grade: string;
  preparedBy: string;
  datePrepared?: string;
  status: "pending_signature" | "signed";
  eligibility: string;
};

export type Sf10Status = "missing" | "available" | "attach" | "released";

export type Sf10Level = {
  grade: string;
  attach: number;
  available: number;
  missing: number;
  released: number;
};

export const SF10_STATUS_META: Record<
  Sf10Status,
  { label: string; color: string }
> = {
  missing: { label: "Missing", color: "var(--destructive)" },
  available: { label: "Available", color: "var(--warning, #d97706)" },
  attach: { label: "Attached", color: "var(--primary)" },
  released: { label: "Released", color: "var(--chart-4)" },
};

export const GRADE_ORDER = [
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
];

export type TabId = "anecdotal" | "attendance" | "adm" | "sf10";

export type TabDef = {
  id: TabId;
  label: string;
  icon: ComponentType<{ className?: string; size?: number }>;
  href: string;
  value?: number;
  hint: string;
};

// Tab definitions only — counts and hrefs are supplied live from /api/overview
// so the Overview never displays hardcoded/mock numbers.
export const TABS: Omit<TabDef, "icon">[] = [
  {
    id: "anecdotal",
    label: "Anecdotal Records",
    href: "/principal/risk",
    hint: "By category and recently logged learners",
  },
  {
    id: "attendance",
    label: "Attendances",
    href: "/principal/risk/heatmaps/attendance",
    hint: "Students below 80% present",
  },
  {
    id: "adm",
    label: "ADM",
    href: "/principal/adm",
    hint: "Active learner profiles",
  },
  {
    id: "sf10",
    label: "SF10",
    href: "/principal/academics",
    hint: "Cumulative learner forms",
  },
];

// Maps each tab to its live count from the /api/overview response.
export function tabValueFor(id: TabId, data: OverviewData | null): number {
  if (!data) return 0;
  switch (id) {
    case "anecdotal":
      return data.kpis.anecdotals;
    case "attendance":
      return data.attendanceWatch;
    case "adm":
      return data.admPending;
    case "sf10":
      return data.kpis.enrollment;
    default:
      return 0;
  }
}

export const SCHOOL_NAME = "Mati School of Arts and Trades";

export type OverviewData = {
  kpis: {
    enrollment: number;
    activeSections: number;
    teachers: number;
    anecdotals: number;
  };
  atRisk: {
    attendance: number;
    grades: number;
    behavior: number;
    students: number;
  };
  admPending: number;
  accountApprovals: number;
  attendanceWatch: number;
  honorRoll: number;
};
