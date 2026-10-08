export type GuidanceAnecdotalCategory =
  | "behavioral"
  | "bullying"
  | "academic"
  | "attendance"
  | "health";

export interface GuidanceSessionDocFile {
  id: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
}

export interface GuidanceSessionDocs {
  sessionId: string;
  sessionType: "individual" | "parent_conference" | "group" | "home_visit";
  date: string;
  files: GuidanceSessionDocFile[];
}

export interface GuidanceAnecdotalRecord {
  id: string;
  referralId: string;
  student: string;
  lrn: string;
  section: string;
  grade: string;
  category: GuidanceAnecdotalCategory;
  observer: string;
  referredBy: string;
  date: string;
  confidentiality: string;
  referralStatus: string;

  sessionDocs?: GuidanceSessionDocs[];

  referralType?: string;
}

export interface GuidanceAnecdotalGradeCount {
  grade: string;
  count: number;
}

export interface GuidanceAnecdotalTopStudent {
  student: string;
  lrn: string;
  section: string;
  count: number;
}

export interface GuidanceAnecdotalSummary {
  total: number;
  behavioral: number;
  bullying: number;
  academic: number;
  attendance: number;
  health: number;
  byGrade?: GuidanceAnecdotalGradeCount[];
  topStudents?: GuidanceAnecdotalTopStudent[];
}

export interface GuidanceAnecdotalData {
  summary: GuidanceAnecdotalSummary;
  records: GuidanceAnecdotalRecord[];
  page: number;
  pageSize: number;

  total: number;
  totalPages: number;

  unfilteredTotal?: number;
}

export type GuidanceAnecdotalTypeFilter = "" | "ADM" | "Counseling";

export interface GuidanceAnecdotalParams {
  q?: string;
  category?: "" | GuidanceAnecdotalCategory;
  type?: GuidanceAnecdotalTypeFilter;

  docsOnly?: boolean;
  page?: number;
  pageSize?: number;
}
