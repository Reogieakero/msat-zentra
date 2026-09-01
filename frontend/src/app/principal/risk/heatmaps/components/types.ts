// Shared types for the risk heatmap components. These mirror the JSON shapes
// returned by the backend (see attendance.routes.ts, academics.service.ts, risk
// endpoints). No mock data lives here — every value is sourced from the API.

export type RiskLevelKey = "High" | "Moderate" | "Low";
export type RiskFactor = "Academic" | "Attendance" | "Behavioral";

export interface HeatmapSection {
  sectionId: string;
  section: string;
  gradeLevel: string;
  factors: Record<RiskFactor, number>;
}

export interface HeatmapData {
  termId: string;
  sections: HeatmapSection[];
  factorTotals: Record<RiskFactor, number>;
}

export interface HeatmapStudent {
  lrn: string;
  name: string;
  riskLevel: RiskLevelKey;
  factor: RiskFactor;
}

export interface MenuSection {
  id: string;
  section: string;
  grade: string;
}

export interface AttendanceDay {
  date: string;
  isoDate: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  total: number;
}

export interface SectionAttendance {
  sectionId: string;
  section: string;
  gradeLevel: string;
  enrolled: number;
  days: AttendanceDay[];
}

export interface SectionAttendanceStat {
  sectionId: string;
  section: string;
  gradeLevel: string;
  enrolled: number;
  rate: number; // 0..100 — avg present per school day ÷ headcount
  belowDays: number; // days under 80%
  amRate: number; // 0..100
  pmRate: number; // 0..100
  trend: "up" | "down" | "flat";
}

export interface TrendPoint {
  date: string;
  rate: number; // 0..100 — daily present ÷ the relevant headcount (section or school)
}

export interface SessionPattern {
  amRate: number;
  pmRate: number;
  byDay: { day: string; rate: number }[];
}

export interface AcademicHeatmapCell {
  subject: string;
  below75Pct: number; // 0..100, % of section below passing for this subject
  below75Count: number;
  enrolled: number;
}

export interface AcademicHeatmapSection {
  sectionId: string;
  section: string;
  gradeLevel: string;
  cells: AcademicHeatmapCell[];
  anyAtRisk: boolean;
  studentsBelow: number;
}

export interface AcademicHeatmapData {
  termId: string;
  subjects: string[];
  sections: AcademicHeatmapSection[];
  subjectTotals: { subject: string; below75Pct: number; below75Count: number }[];
}
