export interface GcForm03Source {
  student: string;
  grade: string;
  section: string;
  category?: string;
  anecdotalExcerpt?: string;
  reason: string;
  recommendations?: string;
  referredBy: string;
  date: string;
}

export interface GcForm03ActionRow {
  date: string;
  action: string;
}

export interface GcForm03CallRow {
  call: string;
  checked: boolean;
  date: string;
  subject: string;
  remarks: string;
}

export interface GcForm03Concerns {
  absences: boolean;
  academic: boolean;
  personal: boolean;
  family: boolean;
  peer: boolean;
  others: boolean;
  othersText: string;
}

export interface GcForm03Data {
  studentName: string;
  gradeSection: string;
  concerns: GcForm03Concerns;
  detailsOfConcern: string;
  referrerActions: GcForm03ActionRow[];
  referrerRecommendations: string;
  referredByName: string;
  referredByRole: string;
  referredDate: string;
  receivedBy: string;
  receivedDate: string;
  guidanceCalls: GcForm03CallRow[];
  guidanceRecommendations: string;
  followUp: string;
  counselorName: string;
  counselorDate: string;
}

export const CONCERN_OPTIONS: { key: keyof Omit<GcForm03Concerns, "othersText">; label: string }[] = [
  { key: "absences", label: "Absences / Tardiness / Cutting classes" },
  { key: "academic", label: "Academic Problems" },
  { key: "personal", label: "Personal Problems" },
  { key: "family", label: "Family Problems" },
  { key: "peer", label: "Peer Problems" },
  { key: "others", label: "Others" },
];

export const TEMPLATE_CONCERN_LABELS = {
  absences: { label: "Absences/Tardiness/Cutting classes", doubleSpace: true },
  academic: { label: "Academic Problems", doubleSpace: true },
  personal: { label: "Personal Problems", doubleSpace: true },
  family: { label: "Family Problems", doubleSpace: false },
  peer: { label: "Peer Problems", doubleSpace: false },
} as const;

export type TemplateConcernKey = keyof typeof TEMPLATE_CONCERN_LABELS;

export const REFERRER_ROLES = [
  "School Nurse",
  "Prefect of Discipline",
  "Teacher",
  "Adviser",
];
