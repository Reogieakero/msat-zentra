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
  status: "pending_signature" | "signed";
  eligibility: string;
};

export const ADM_DOCUMENTS: AdmDocument[] = [
  {
    id: "ADM-2041",
    lrn: "109876543220",
    student: "A. Mendoza",
    grade: "Grade 7",
    preparedBy: "Mr. Cruz",
    datePrepared: "Aug 19, 2026",
    status: "pending_signature",
    eligibility: "Eligible",
  },
  {
    id: "ADM-2042",
    lrn: "109876543221",
    student: "J. Fernando",
    grade: "Grade 8",
    preparedBy: "Ms. Reyes",
    datePrepared: "Aug 20, 2026",
    status: "pending_signature",
    eligibility: "Eligible",
  },
  {
    id: "ADM-2043",
    lrn: "109876543222",
    student: "K. Villanueva",
    grade: "Grade 9",
    preparedBy: "Ms. Santos",
    datePrepared: "Aug 21, 2026",
    status: "pending_signature",
    eligibility: "For Review",
  },
  {
    id: "ADM-2039",
    lrn: "109876543218",
    student: "R. Aquino",
    grade: "Grade 10",
    preparedBy: "Mr. Dela Torre",
    datePrepared: "Aug 17, 2026",
    status: "signed",
    eligibility: "Eligible",
  },
];

export const ADM_DONUT_COLORS = [
  "#166534",
  "#1d4ed8",
  "#b91c1c",
  "#c2410c",
  "#7c3aed",
  "#0e7490",
];

export type Sf10Status = "missing" | "available" | "attached";

export type Sf10Level = {
  grade: string;
  attached: number;
  available: number;
  missing: number;
};

export const SF10_LEVELS: Sf10Level[] = [
  { grade: "Grade 7", attached: 2, available: 1, missing: 1 },
  { grade: "Grade 8", attached: 1, available: 2, missing: 0 },
  { grade: "Grade 9", attached: 2, available: 0, missing: 1 },
  { grade: "Grade 10", attached: 1, available: 1, missing: 1 },
  { grade: "Grade 11", attached: 2, available: 1, missing: 0 },
  { grade: "Grade 12", attached: 1, available: 0, missing: 1 },
];

export const SF10_STATUS_META: Record<
  Sf10Status,
  { label: string; color: string }
> = {
  missing: { label: "Missing", color: "#b91c1c" },
  available: { label: "Available", color: "#c2410c" },
  attached: { label: "Attached", color: "#166534" },
};

export type SchoolDay = {
  grade: string;
  days: { present: number; total: number }[];
};

function buildDays(seed: number, baseRate: number): { present: number; total: number }[] {
  const days: { present: number; total: number }[] = [];
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = 0; i < 100; i++) {
    const total = 30 + Math.floor(rand() * 6);
    const drift = (rand() - 0.5) * 0.12;
    const rate = Math.min(1, Math.max(0.7, baseRate + drift));
    days.push({ present: Math.round(total * rate), total });
  }
  return days;
}

export const SCHOOL_DAYS: SchoolDay[] = [
  { grade: "Grade 7", days: buildDays(11, 0.97) },
  { grade: "Grade 8", days: buildDays(29, 0.96) },
  { grade: "Grade 9", days: buildDays(47, 0.95) },
  { grade: "Grade 10", days: buildDays(63, 0.94) },
  { grade: "Grade 11", days: buildDays(81, 0.96) },
  { grade: "Grade 12", days: buildDays(97, 0.9) },
];

export type AccountApproval = {
  id: string;
  name: string;
  email: string;
  role: string;
  routedTo: "record_keeper" | "registrar";
  status: "pending" | "approved";
};

export const ACCOUNT_APPROVALS: AccountApproval[] = [
  {
    id: "ACC-441",
    name: "Ms. P. Bautista",
    email: "p.bautista@zentra.test",
    role: "Adviser (Grade 7)",
    routedTo: "record_keeper",
    status: "pending",
  },
  {
    id: "ACC-442",
    name: "Mr. L. Mercado",
    email: "l.mercado@zentra.test",
    role: "Subject Teacher",
    routedTo: "record_keeper",
    status: "pending",
  },
  {
    id: "ACC-443",
    name: "Ms. C. Ramos",
    email: "c.ramos@zentra.test",
    role: "Registrar Asst.",
    routedTo: "registrar",
    status: "pending",
  },
];

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
  value: number;
  hint: string;
};

export const TABS: Omit<TabDef, "icon">[] = [
  {
    id: "anecdotal",
    label: "Anecdotal Records",
    href: "/principal/risk",
    value: 312,
    hint: "By category and recently logged learners",
  },
  {
    id: "attendance",
    label: "Attendances",
    href: "/principal/risk",
    value: 47,
    hint: "Students below 80% present",
  },
  {
    id: "adm",
    label: "ADM",
    href: "/principal/adm",
    value: 18,
    hint: "Active learner profiles",
  },
  {
    id: "sf10",
    label: "SF10",
    href: "/principal/reports",
    value: 1240,
    hint: "Cumulative learner forms",
  },
];

type RiskFactors = {
  attendance: number;
  grades: number;
  behavior: number;
  wellbeing: number;
};

export const SCHOOL_NAME = "Mati School of Arts and Trades";

export type OverviewData = {
  schoolName?: string;
  kpis: {
    enrollment: number;
    activeSections: number;
    teachers: number;
    anecdotals: number;
  };
  atRisk: RiskFactors;
};

export const MOCK: OverviewData = {
  schoolName: "Mati School of Arts and Trades",
  kpis: {
    enrollment: 1284,
    activeSections: 36,
    teachers: 58,
    anecdotals: 312,
  },
  atRisk: {
    attendance: 47,
    grades: 63,
    behavior: 28,
    wellbeing: 12,
  },
};
