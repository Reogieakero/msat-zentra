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
      "Principal approves the certification and authorizes release of the module, scheduling of module distribution and submission, and follow-up counseling / psychosocial intervention.",
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

export const MOCK_ADM_CASES: AdmCase[] = [
  {
    id: "ADM-2041",
    student: "Maria Santos",
    lrn: "11876543210",
    grade: "Grade 9",
    section: "9-B",
    stage: "principal_approval",
    eligibilityStatus: "eligible",
    meetingAttended: true,
    modulesSubmitted: 6,
    modulesTotal: 6,
    deviceIssued: false,
    preparedBy: "ADM Coordinator",
    datePrepared: "2026-08-18",
    approvedBy: null,
    approvalDate: null,
  },
  {
    id: "ADM-2038",
    student: "John Dela Cruz",
    lrn: "11876543211",
    grade: "Grade 7",
    section: "7-A",
    stage: "principal_approval",
    eligibilityStatus: "eligible",
    meetingAttended: true,
    modulesSubmitted: 5,
    modulesTotal: 6,
    deviceIssued: false,
    preparedBy: "ADM Coordinator",
    datePrepared: "2026-08-19",
    approvedBy: null,
    approvalDate: null,
  },
  {
    id: "ADM-2033",
    student: "Angela Reyes",
    lrn: "11876543212",
    grade: "Grade 11",
    section: "11-C",
    stage: "enrollment_monitoring",
    eligibilityStatus: "eligible",
    meetingAttended: true,
    modulesSubmitted: 3,
    modulesTotal: 8,
    deviceIssued: true,
    preparedBy: "ADM Coordinator",
    datePrepared: "2026-08-12",
    approvedBy: "Principal",
    approvalDate: "2026-08-15",
  },
  {
    id: "ADM-2029",
    student: "Paolo Mendoza",
    lrn: "11876543213",
    grade: "Grade 8",
    section: "8-D",
    stage: "meeting_parents",
    eligibilityStatus: "pending",
    meetingAttended: false,
    modulesSubmitted: 0,
    modulesTotal: 6,
    deviceIssued: false,
    preparedBy: "ADM Coordinator",
    datePrepared: "2026-08-10",
    approvedBy: null,
    approvalDate: null,
  },
  {
    id: "ADM-2024",
    student: "Sofia Garcia",
    lrn: "11876543214",
    grade: "Grade 10",
    section: "10-A",
    stage: "home_visitation",
    eligibilityStatus: "pending",
    meetingAttended: false,
    modulesSubmitted: 0,
    modulesTotal: 7,
    deviceIssued: false,
    preparedBy: "ADM Coordinator",
    datePrepared: "2026-08-08",
    approvedBy: null,
    approvalDate: null,
  },
  {
    id: "ADM-2017",
    student: "Rico Villanueva",
    lrn: "11876543215",
    grade: "Grade 12",
    section: "12-B",
    stage: "meeting_parents",
    eligibilityStatus: "ineligible",
    meetingAttended: false,
    modulesSubmitted: 0,
    modulesTotal: 8,
    deviceIssued: false,
    preparedBy: "ADM Coordinator",
    datePrepared: "2026-08-05",
    approvedBy: null,
    approvalDate: null,
  },
  {
    id: "ADM-2009",
    student: "Liza Castillo",
    lrn: "11876543216",
    grade: "Grade 9",
    section: "9-C",
    stage: "completion",
    eligibilityStatus: "eligible",
    meetingAttended: true,
    modulesSubmitted: 6,
    modulesTotal: 6,
    deviceIssued: true,
    preparedBy: "ADM Coordinator",
    datePrepared: "2026-07-28",
    approvedBy: "Principal",
    approvalDate: "2026-08-01",
  },
  {
    id: "ADM-2003",
    student: "Mark Fernandez",
    lrn: "11876543217",
    grade: "Grade 7",
    section: "7-B",
    stage: "completion",
    eligibilityStatus: "eligible",
    meetingAttended: true,
    modulesSubmitted: 6,
    modulesTotal: 6,
    deviceIssued: true,
    preparedBy: "ADM Coordinator",
    datePrepared: "2026-07-22",
    approvedBy: "Principal",
    approvalDate: "2026-07-30",
  },
  {
    id: "ADM-2047",
    student: "Bea Lorenzo",
    lrn: "11876543218",
    grade: "Grade 8",
    section: "8-A",
    stage: "principal_approval",
    eligibilityStatus: "eligible",
    meetingAttended: true,
    modulesSubmitted: 4,
    modulesTotal: 6,
    deviceIssued: false,
    preparedBy: "ADM Coordinator",
    datePrepared: "2026-08-20",
    approvedBy: null,
    approvalDate: null,
  },
  {
    id: "ADM-2050",
    student: "Carlos Ramos",
    lrn: "11876543219",
    grade: "Grade 10",
    section: "10-C",
    stage: "principal_approval",
    eligibilityStatus: "eligible",
    meetingAttended: true,
    modulesSubmitted: 7,
    modulesTotal: 7,
    deviceIssued: false,
    preparedBy: "ADM Coordinator",
    datePrepared: "2026-08-21",
    approvedBy: null,
    approvalDate: null,
  },
  {
    id: "ADM-2053",
    student: "Hannah Cruz",
    lrn: "11876543220",
    grade: "Grade 11",
    section: "11-A",
    stage: "principal_approval",
    eligibilityStatus: "eligible",
    meetingAttended: true,
    modulesSubmitted: 8,
    modulesTotal: 8,
    deviceIssued: false,
    preparedBy: "ADM Coordinator",
    datePrepared: "2026-08-22",
    approvedBy: null,
    approvalDate: null,
  },
  {
    id: "ADM-2006",
    student: "Gabriel Tan",
    lrn: "11876543221",
    grade: "Grade 9",
    section: "9-A",
    stage: "completion",
    eligibilityStatus: "eligible",
    meetingAttended: true,
    modulesSubmitted: 6,
    modulesTotal: 6,
    deviceIssued: true,
    preparedBy: "ADM Coordinator",
    datePrepared: "2026-07-25",
    approvedBy: "Principal",
    approvalDate: "2026-07-29",
  },
  {
    id: "ADM-2012",
    student: "Ella Manalo",
    lrn: "11876543222",
    grade: "Grade 12",
    section: "12-A",
    stage: "completion",
    eligibilityStatus: "eligible",
    meetingAttended: true,
    modulesSubmitted: 8,
    modulesTotal: 8,
    deviceIssued: true,
    preparedBy: "ADM Coordinator",
    datePrepared: "2026-07-18",
    approvedBy: "Principal",
    approvalDate: "2026-07-24",
  },
];

export function isAwaitingSignature(c: AdmCase): boolean {
  return (
    c.stage === "principal_approval" &&
    c.approvedBy === null &&
    c.eligibilityStatus === "eligible"
  );
}

/** Human-readable, title-cased label for a pipeline stage (no underscores). */
export function stageLabel(stage: AdmPipelineStage): string {
  return (
    ADM_PIPELINE.find((s) => s.stage === stage)?.label ??
    stage.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase())
  );
}

/** 0-based index of a case's current stage in the pipeline. */
export function stageIndex(c: AdmCase): number {
  return ADM_PIPELINE.findIndex((s) => s.stage === c.stage);
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

/** Maps an ADM form type to its display color and label (mirrors FormIcon FORM_META). */
const FORM_DOC_META: Record<
  string,
  { label: string; color: string }
> = {
  REFERRAL_FORM: { label: "Referral Form", color: "#ffc371" },
  ANECDOTAL_REPORT: { label: "Anecdotal Report", color: "#4facfe" },
  CERTIFICATION: { label: "Certification", color: "#00f2fe" },
  MINUTES_OF_MEETING: { label: "Minutes of Meeting", color: "#a18cd1" },
  HV_FORM: { label: "Home Visit Form", color: "#ff5f6d" },
};

/**
 * Builds the document cards shown in the approval dialog from the files
 * actually attached to an ADM case (its `forms`), instead of the static list.
 */
export function formsToDocuments(
  forms: { id: string; formType: string; title: string; status: string }[] | undefined
): AdmDocument[] {
  if (!forms || forms.length === 0) return [];
  return forms.map((f) => {
    const meta = FORM_DOC_META[f.formType] ?? {
      label: f.title || f.formType,
      color: "var(--primary)",
    };
    const label = meta.label.replace(/\s+/g, "_");
    const statusTag =
      f.status === "verified"
        ? "verified"
        : f.status === "submitted"
        ? "submitted"
        : "pending";
    return {
      name: `${label}.pdf`,
      type: "PDF",
      size: statusTag === "verified" ? "verified" : "submitted",
      color: meta.color,
      icon: "pdf" as const,
    };
  });
}
