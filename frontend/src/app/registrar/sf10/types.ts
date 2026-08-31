export type Sf10Status = "attach" | "available" | "released";
export type Sf10Source = "ocr_upload" | "manual" | "auto_populated";

export type Sf10Version = {
  versionNumber: number;
  changedBy: string;
  changeReason: string;
  changedAt: string; // ISO
};

export type Sf10Record = {
  id: string;
  studentId: string;
  lrn: string;
  fullName: string;
  gradeLevel: "G7" | "G8" | "G9" | "G10" | "G11" | "G12";
  section: string;
  status: Sf10Status;
  source: Sf10Source;
  uploadedFileUrl: string | null;
  uploadedAt: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  validatedBy: string | null;
  validatedAt: string | null;
  releasedAt: string | null;
  archivedAt: string | null;
  currentVersion: number;
  updatedAt: string;
  versions: Sf10Version[];
};

export type Sf10RecordsResponse = { records: Sf10Record[] };

export const SF10_STATUS_LABEL: Record<Sf10Status, string> = {
  attach: "Attached",
  available: "Available",
  released: "Released",
};

export const SF10_SOURCE_LABEL: Record<Sf10Source, string> = {
  ocr_upload: "OCR Upload",
  manual: "Manual",
  auto_populated: "Auto-populated",
};

export const GRADE_LABEL: Record<string, string> = {
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};
