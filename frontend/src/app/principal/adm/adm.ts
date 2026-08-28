export type AdmPipelineStage =
  | "anecdotal"
  | "consultation"
  | "meeting_parents"
  | "home_visitation"
  | "certification"
  | "principal_approval"
  | "enrollment_monitoring"
  | "completion";

export type AdmCase = {
  id: string;
  student: string;
  lrn: string;
  grade: string;
  section: string;
  /** Current stage in the 8-step ADM pipeline. */
  stage: AdmPipelineStage;
  eligibilityStatus: "pending" | "eligible" | "ineligible";
  meetingAttended: boolean;
  modulesSubmitted: number;
  modulesTotal: number;
  deviceIssued: boolean;
  preparedBy: string;
  datePrepared: string;
  approvedBy: string | null;
  approvalDate: string | null;
  forms?: { id: string; formType: string; title: string; status: string }[];
};

export const ADM_PIPELINE: {
  stage: AdmPipelineStage;
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
    description:
      "Adviser files the anecdotal report documenting the learner's behavioral or academic concern.",
  },
  {
    stage: "consultation",
    order: 2,
    label: "Consultation & Referral",
    owner: "Guidance / Nurse / LRPC",
    principalAction: false,
    description:
      "Routed to Guidance Counselor, School Nurse, or Learner Rights and Protection Committee. Means of verification: Guidance and CPP Forms, HEEADSS & CSSRS, Referral Form.",
  },
  {
    stage: "meeting_parents",
    order: 3,
    label: "Meeting with Parents/Guardians",
    owner: "ADM Coordinator & Teachers",
    principalAction: false,
    description:
      "Meeting with Parents/Legal Guardians attended by the ADM Coordinator and Teachers. Decision point: did parents attend? YES → Minutes of Meeting & Attendance Logbook. NO → Home Visitation (HV Form).",
  },
  {
    stage: "home_visitation",
    order: 4,
    label: "Home Visitation (if no meeting)",
    owner: "Guidance Counselor",
    principalAction: false,
    description:
      "If parents did not attend the meeting, a Home Visitation is conducted (GCForm-12, Class Adviser with Guidance Counselor certification). Means of verification: HV Form. Both branches converge at the ADM Coordinator recommendation.",
  },
  {
    stage: "certification",
    order: 5,
    label: "Recommendation & Certification",
    owner: "ADM Coordinator",
    principalAction: false,
    description:
      "ADM Coordinator records the recommendation and issues the ADM Certification, preparing the module for release.",
  },
  {
    stage: "principal_approval",
    order: 6,
    label: "School Head (Principal) Approval",
    owner: "Principal",
    principalAction: true,
    description:
      "Principal signs the certification and authorizes release of the module, scheduling of module distribution and submission, and follow-up counseling / psychosocial intervention.",
  },
  {
    stage: "enrollment_monitoring",
    order: 7,
    label: "Modules Completed & Returned",
    owner: "Student",
    principalAction: false,
    description:
      "Student completes the modules and returns to school. Progress is tracked by the Coordinator / Teacher.",
  },
  {
    stage: "completion",
    order: 8,
    label: "Case Closed",
    owner: "ADM Coordinator",
    principalAction: false,
    description: "Learner has returned to school and the ADM case is closed.",
  },
];

export function isAwaitingSignature(c: AdmCase): boolean {
  return (
    c.stage === "principal_approval" &&
    c.approvedBy === null &&
    c.eligibilityStatus === "eligible"
  );
}

/** A case can be returned only after the principal has signed it. */
export function canReturn(c: AdmCase): boolean {
  return c.approvedBy !== null;
}

/** Human-readable, title-cased label for a pipeline stage (no underscores). */
export function stageLabel(stage: AdmPipelineStage): string {
  return (
    ADM_PIPELINE.find((s) => s.stage === stage)?.label ??
    stage.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase())
  );
}

export type AdmDocument = {
  name: string;
  type: string;
  size: string;
  /** File slot color, mirrors the Uiverse folder-card file palette. */
  color: string;
  icon: "image" | "video" | "code" | "pdf" | "ppt";
};

/** Representative ADM documents bundled per approved learner profile. */
export const ADM_DOCUMENTS: AdmDocument[] = [
  {
    name: "Referral_Form.pdf",
    type: "PDF",
    size: "1.1 MB",
    color: "#ffc371",
    icon: "pdf",
  },
  {
    name: "Anecdotal_Report.pdf",
    type: "PDF",
    size: "0.8 MB",
    color: "#4facfe",
    icon: "pdf",
  },
  {
    name: "Certification.pdf",
    type: "PDF",
    size: "0.6 MB",
    color: "#00f2fe",
    icon: "pdf",
  },
  {
    name: "Minutes_of_Meeting.pdf",
    type: "PDF",
    size: "0.9 MB",
    color: "#a18cd1",
    icon: "pdf",
  },
  {
    name: "HV_Form.pdf",
    type: "PDF",
    size: "0.7 MB",
    color: "#ff5f6d",
    icon: "pdf",
  },
];
