export type Sf10Status = "attach" | "available" | "released";
export type Sf10Source = "ocr_upload" | "manual" | "auto_populated";
export type Sf10Desk = "registrar" | "record_keeper";

export type Sf10Version = {
  versionNumber: number;
  changedBy: string;
  changeReason: string;
  changedAt: string;
};

export type Sf10Record = {
  id: string;
  studentId: string;
  /** Desk that filed this record — each desk keeps its own per student. */
  desk: Sf10Desk;
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

  versions?: Sf10Version[];
};

export type Sf10RecordsResponse = {
  records: Sf10Record[];
  total: number;
  page: number;
  pageSize: number;
  counts: { attach: number; available: number; released: number; total: number };
};

export type Sf10OcrSubject = {
  rawName: string;
  norm: string;
  grade?: number | null;
};

export type Sf10SubjectMapEntry = {
  code: string;
  name: string;
  norm: string;
  rating?: number | null;
  quarters?: Array<number | null> | null;
  remarks?: string | null;
  /** File position: grade tables list subjects as on record. */
  order?: number | null;
};

export type Sf10FileOnlyEntry = {
  rawName: string;
  norm: string;
  gradeLevel: string | null;
  rating: number | null;
  quarters: Array<number | null> | null;
  remarks: string | null;
};

export type Sf10DeficiencyEntry = Sf10SubjectMapEntry & {
  gradeLevel: string;
  category: string;
  reason: "not-taken";
};

export type Sf10PerGradeExtra = {
  rawName: string;
  norm: string;
  rating: number | null;
  quarters: Array<number | null> | null;
  remarks: string | null;
  /** File position: grade tables list subjects as on record. */
  order?: number | null;
};

export type Sf10PerGradeMap = {
  gradeLevel: string;
  matched: Sf10SubjectMapEntry[];
  missing: (Sf10SubjectMapEntry & { category: string })[];
  /** File rows for this grade matching no catalog subject (previous school). */
  extras: Sf10PerGradeExtra[];
  total: number;
};

export type Sf10SubjectMapResponse = {
  id: string;
  gradeLevel: string;
  ocrStatus: "ready" | "processing";
  confidence: number;
  /** Learner name read from the uploaded file itself. */
  learner: Sf10LearnerIdentity | null;
  needsReview: boolean;
  schoolSubjectCount: number;
  ocrSubjectCount: number;
  matched: Sf10SubjectMapEntry[];
  sf10Only: Sf10FileOnlyEntry[];
  missing: Sf10SubjectMapEntry[];
  perGrade: Sf10PerGradeMap[];
  deficiencies: Sf10DeficiencyEntry[];
  /** File rows with no grade indicated: add-ons, own table. */
  addons: Sf10PerGradeExtra[];
  coverage: { gradesDetected: string[] };
};

export type Sf10DetailResponse = {
  record: Sf10Record;
  versions: Sf10Version[];
  map: Sf10SubjectMapResponse;
};

export type Sf10UploadResult = {
  id: string;
  source: Sf10Source;
  uploadedFileUrl: string;
  ocrStatus: "processing" | "ready";
};

export type Sf10AutoUploadResult = Sf10UploadResult & {
  studentCreated: boolean;
  learner: Sf10LearnerIdentity | null;
  matched: { kind: string; score: number; fullName: string } | null;
  gradeLevel: string;
  deficiencies: Array<{ code: string; name: string; norm: string; gradeLevel: string; category: string }>;
};

export type Sf10LearnerIdentity = {
  lrn: string | null;
  lastName: string | null;
  firstName: string | null;
  middleName: string | null;
  suffix: string | null;
  fullName: string | null;
  confidence: number;
};

export type Sf10RosterCandidate = {
  studentId: string;
  lrn: string;
  fullName: string;
  gradeLevel: string;
  section: string;
  matchKind: string;
  score: number;
};

export type Sf10AnalyzeResponse = {
  learner: Sf10LearnerIdentity;
  candidates: Sf10RosterCandidate[];
  rosterOnlyLrn: boolean;
};

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
