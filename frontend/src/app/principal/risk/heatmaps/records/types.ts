// Types for the behavioral records heatmap. The runtime data is fetched from
// GET /api/anecdotal/records (see backend anecdotal.routes.ts). No mock data
// is defined here.

export type StudentStatus = "Active" | "Transferred" | "Inactive" | "New";

// Mirrors the backend AnecdotalCategory enum.
export type BehavioralCategory =
  | "behavioral"
  | "bullying"
  | "academic"
  | "attendance"
  | "health";

export interface BehavioralRecord {
  id: string;
  date: string;
  category: BehavioralCategory;
  description: string;
  severity: "Low" | "Moderate" | "High";
  staff: string;
  resolution: string;
  followUp: "Pending" | "Resolved" | "Monitoring";
}

export interface AcademicRecord {
  averageGrade: string;
  sf10Status: "Complete" | "Incomplete" | "Missing";
  missingRecords: string[];
  completion: number;
}

export interface RecordStudent {
  lrn: string;
  name: string;
  status: StudentStatus;
  gradeLevel: string;
  section: string;
  sectionId: string;
  academic: AcademicRecord;
  behavioral: BehavioralRecord[];
}

export interface RecordSection {
  sectionId: string;
  section: string;
  gradeLevel: string;
  students: RecordStudent[];
}

export interface RecordDataset {
  schoolYear: string;
  sections: RecordSection[];
}
