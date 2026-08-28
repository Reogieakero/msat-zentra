export type RiskLevel = "High" | "Moderate" | "Low";
export type Remarks = "Passed" | "Failed";
export type SubjectStatus = "On Track" | "At Risk" | "Failing";

export interface StudentSubject {
  subject: string;
  computedAverage: number;
  transmutedGrade: number;
  remarks: Remarks;
}

export interface StudentRow {
  studentId: string;
  lrn: string;
  name: string;
  riskLevel: RiskLevel;
  overallAverage: number;
  attendanceRatePct: number;
  subjects: StudentSubject[];
}

export interface SectionSummary {
  sectionId: string;
  section: string;
  grade: string;
  avgTransmuted: number;
  passPct: number;
  failPct: number;
  atRiskCount: number;
  students: StudentRow[];
}

export interface PassFailByGrade {
  grade: string;
  passed: number;
  failed: number;
}

export type HonorRollTier = "Highest Honors" | "High Honors" | "With Honors";

export interface HonorRollCandidate {
  studentId: string;
  name: string;
  overallAverage: number;
  tier: HonorRollTier;
}

export interface PotentialHonorCandidate {
  studentId: string;
  name: string;
  overallAverage: number;
  tier: HonorRollTier;
  unlockedSubjects: number;
}

export interface AcademicsSummary {
  termLabel: string;
  sections: SectionSummary[];
  passFailByGrade: PassFailByGrade[];
  honorRollPreview: HonorRollCandidate[];
  potentialHonorRoll: PotentialHonorCandidate[];
}

/** Alias retained for the academics page response type. */
export type AcademicsMock = AcademicsSummary;

/** Subject name → short display code used in compact student cards. */
export const SUBJECT_CODES: Record<string, string> = {
  English: "ENG",
  Mathematics: "MATH",
  Science: "SCI",
  Filipino: "FIL",
  "Araling Panlipunan": "AP",
  "Edukasyon sa Pagpapakatao": "ESP",
  TLE: "TLE",
  MAPEH: "MAP",
  ICT: "ICT",
};

/** Fallback subject column order when no section has been selected yet. */
export const subjectColumns: string[] = [
  "English",
  "Mathematics",
  "Science",
  "Filipino",
  "Araling Panlipunan",
  "Edukasyon sa Pagpapakatao",
  "TLE",
  "MAPEH",
  "ICT",
];
