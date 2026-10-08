export type AnecdotalCategory =
  | "behavioral"
  | "bullying"
  | "academic"
  | "attendance"
  | "health";

export type AnecdotalTier = "restricted" | "confidential";

export const ANEC_CATEGORY_LABELS: Record<AnecdotalCategory, string> = {
  behavioral: "Behavioral",
  bullying: "Bullying",
  academic: "Academic",
  attendance: "Attendance",
  health: "Health",
};

export const ANEC_TIER_LABELS: Record<AnecdotalTier, string> = {
  restricted: "Restricted",
  confidential: "Confidential",
};

export interface AnecdotalStudent {
  id: string;
  name: string;
  lrn: string;
  sectionId?: string | null;
}

export interface AnecdotalClassOption {
  subjectId: string;
  subjectName: string;
  sectionId: string;
  sectionName: string;
  termId: string;
  termNumber: number;
  ownerName?: string;
}

export interface AnecdotalOptions {
  students: AnecdotalStudent[];
  classes: AnecdotalClassOption[];
  sectionClasses: AnecdotalClassOption[];
}

export interface AnecdotalPayload {
  studentId: string;
  sectionId: string;
  termId: string;
  observationDatetime: string;
  descriptionOfIncident: string;
  descriptionOfLocation?: string;
  notesRecommendationsActions?: string;
  classPerformance?: string;
  attendanceSummary?: string;
  category: AnecdotalCategory;
  confidentialityLevel: AnecdotalTier;
}

export interface CreatedAnecdotalRecord extends AnecdotalPayload {
  id: string;
  folderId: string | null;
}

export interface FiledDetail {
  recordId: string;
  folderId?: string | null;
  studentName: string;
  lrn: string;
  section: string;
  category: string;
  tier: string;
  location: string;
  incident: string;
  notes: string;
  classPerformance: string;
  attendanceSummary: string;
  observationDateTime: string;
  filedOn: string;
}

export interface PreviewDetail {
  studentName: string;
  lrn: string;
  section: string;
  category: string;
  tier: string;
  location: string;
  incident: string;
  notes: string;
  classPerformance: string;
  attendanceSummary: string;
  observationDateTime: string;
  filedOn: string;
}

export interface ChatMessage {
  id: number;
  from: "assistant" | "user";
  text: string;
  detail?: FiledDetail;
  preview?: PreviewDetail;
  question?: {
    type: "gcform" | "category" | "tier" | "datetime";
    options: { value: string; label: string }[];
    locked?: boolean;
  };
}
