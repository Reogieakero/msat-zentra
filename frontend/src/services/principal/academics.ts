// Principal academics board: section/grade shapes, DO 15 descriptor
// bands, honor-roll preview shapes, subject vocabulary. Pure — no API
// calls (the board reads the same summary the page assembles).
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
  presentAm: number;
  presentPm: number;
  schoolDays: number;
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

// DO 15, s. 2026 descriptor bands for numeric grades (Key Stages 2-4).
export type DescriptorBand =
  | "Advancing"
  | "Benchmarking"
  | "Connecting"
  | "Developing"
  | "Emerging";

export function descriptorBand(average: number): DescriptorBand {
  if (average >= 90) return "Advancing";
  if (average >= 80) return "Benchmarking";
  if (average >= 75) return "Connecting";
  if (average >= 65) return "Developing";
  return "Emerging";
}

export type AwardStatus = "awarded" | "potential";

export interface HonorRollCandidate {
  studentId: string;
  name: string;
  overallAverage: number;
}

export interface PotentialHonorCandidate {
  studentId: string;
  name: string;
  overallAverage: number;
  unlockedSubjects: number;
}

export interface AcademicsSummary {
  schoolYear: string;
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
