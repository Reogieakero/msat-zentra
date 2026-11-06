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
  rate: number;
  belowDays: number;
  amRate: number;
  pmRate: number;
  trend: "up" | "down" | "flat";
  atRiskStudents: number;
}

export interface TrendPoint {
  date: string;
  rate: number;
}

export interface SessionPattern {
  amRate: number;
  pmRate: number;
  byDay: { day: string; rate: number }[];
}

export interface AcademicHeatmapCell {
  subject: string;
  below75Pct: number;
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
