import { apiClient } from "@/lib/api/client";

/** One ADM case for an advisory student — status-only, never clinical detail. */
export interface AdmCase {
  id: string;
  studentId: string;
  studentName: string;
  lrn: string;
  gradeLevel: string;
  section: string;
  photoUrl: string | null;
  referralId: string;
  referralStatus: "pending" | "in_progress" | "resolved";
  stage: string;
  stageLabel: string;
  eligibilityStatus: "pending" | "eligible" | "ineligible";
  approved: boolean;
  approvedAt: string | null;
  datePrepared: string | null;
  meetingAttended: boolean | null;
  hasHomeVisit: boolean;
  modulesSubmitted: number;
  modulesTotal: number;
  devicesIssued: number;
  devicesReturned: number;
  certificationIssued: boolean;
}

export async function fetchMyAdmCases(): Promise<AdmCase[]> {
  const { data } = await apiClient.get<AdmCase[]>("/api/adm/my-cases");
  return data;
}

/** Official 8-stage ADM pipeline (mirrors backend adm.ts + principal board). */
export const ADM_STAGES: {
  stage: string;
  order: number;
  label: string;
  owner: string;
  principalAction: boolean;
  description: string;
}[] = [
  {
    stage: "anecdotal",
    order: 1,
    label: "Anecdotal Report Filed",
    owner: "Adviser",
    principalAction: false,
    description: "Anecdotal report documenting the learner's concern.",
  },
  {
    stage: "consultation",
    order: 2,
    label: "Consultation & Referral",
    owner: "Guidance / Nurse / LRPC",
    principalAction: false,
    description: "Reviewed by Guidance Counselor, School Nurse, or LRPC.",
  },
  {
    stage: "meeting_parents",
    order: 3,
    label: "Meeting with Parents/Guardians",
    owner: "ADM Coordinator & Teachers",
    principalAction: false,
    description: "Meeting with parents/guardians. Attended → minutes logged; otherwise → home visitation.",
  },
  {
    stage: "home_visitation",
    order: 4,
    label: "Home Visitation (if no meeting)",
    owner: "Guidance Counselor",
    principalAction: false,
    description: "Conducted only when parents did not attend the meeting.",
  },
  {
    stage: "certification",
    order: 5,
    label: "Recommendation & Certification",
    owner: "ADM Coordinator",
    principalAction: false,
    description: "ADM Coordinator records the recommendation and issues the certification.",
  },
  {
    stage: "principal_approval",
    order: 6,
    label: "School Head (Principal) Approval",
    owner: "Principal",
    principalAction: true,
    description: "Principal signs the certification and authorizes module release.",
  },
  {
    stage: "enrollment_monitoring",
    order: 7,
    label: "Modules Completed & Returned",
    owner: "Student",
    principalAction: false,
    description: "Student completes the modules; Coordinator / Teacher track progress.",
  },
  {
    stage: "completion",
    order: 8,
    label: "Case Closed",
    owner: "ADM Coordinator",
    principalAction: false,
    description: "Learner has returned and the ADM case is closed.",
  },
];

export function stageOrder(stage: string): number {
  return ADM_STAGES.find((s) => s.stage === stage)?.order ?? 2;
}

const GRADE_LABELS: Record<string, string> = {
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};

export function gradeLabel(gradeLevel: string): string {
  return GRADE_LABELS[gradeLevel] ?? gradeLevel;
}

export function initialsOf(name: string): string {
  const parts = (name ?? "").trim().split(/\s+/);
  return `${(parts[0] ?? "S").charAt(0)}${(parts[1] ?? "").charAt(0)}`.toUpperCase();
}

/** Deterministic avatar tone (1–5) per student so cards feel distinct. */
export function toneOf(key: string): 1 | 2 | 3 | 4 | 5 {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return ((Math.abs(hash) % 5) + 1) as 1 | 2 | 3 | 4 | 5;
}

export const ELIGIBILITY_LABELS: Record<string, string> = {
  pending: "For review",
  eligible: "Eligible",
  ineligible: "Ineligible",
};
