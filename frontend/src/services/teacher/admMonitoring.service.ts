import { apiClient } from "@/lib/api/client";

/** One module on the adviser's ADM monitoring desk. */
export interface AdmMonitoredModule {
  id: string;
  /** `case` = released from this case; `section` = the section-wide ADM module. */
  source: "case" | "section";
  moduleName: string;
  releaseDate: string | null;
  dueDate: string | null;
  submitted: boolean;
  submissionDate: string | null;
  submissionUrl: string | null;
  studentSubmissionUrl?: string | null;
  submissionKind?: "link" | "file" | "physical" | null;
  fileUrl?: string | null;
  fileName?: string | null;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  status: "submitted" | "pending" | "overdue";
}

export interface AdmMonitoringCase {
  header: {
    profileId: string;
    referralId: string;
    stage: string;
    stageLabel: string;
    eligibilityStatus: string;
    approvedAt: string | null;
    monitoringSince: string;
    studentId: string;
    studentName: string;
    lrn: string;
    mascot: string | null;
    photoUrl: string | null;
    gradeLevel: string;
    section: string;
    referralStatus: string;
    consultReviewer: string | null;
  };
  progress: {
    submitted: number;
    total: number;
    percent: number;
    overdueCount: number;
    nextDueAt: string | null;
    lastSubmittedAt: string | null;
  };
  modules: AdmMonitoredModule[];
  devices: {
    id: string;
    deviceType: string;
    deviceSerial: string;
    issuedDate: string;
    returnedDate: string | null;
    conditionNotes: string | null;
  }[];
  meetings: {
    id: string;
    meetingDatetime: string;
    venue: string;
    attended: boolean;
    minutesOfMeeting: string | null;
  }[];
  forms: {
    id: string;
    formType: string;
    title: string;
    status: string;
    uploadedAt: string | null;
  }[];
  timeline: {
    label: string;
    detail: string | null;
    date: string;
    at: string;
    action: string;
    byRole: string | null;
    source: "referrals" | "counseling_sessions" | "adm_parent_meetings" | "case";
    stage?: string | null;
    homeVisit?: boolean;
  }[];
}

export interface AdmModulePayload {
  moduleName?: string;
  releaseDate?: string | null;
  dueDate?: string | null;
  submissionUrl?: string | null;
  remarks?: string | null;
  submitted?: boolean;
}

export const admMonitoringKey = (caseId: string) => ["adm-monitoring", caseId] as const;

export async function fetchAdmMonitoringCase(
  caseId: string,
  signal?: AbortSignal
): Promise<AdmMonitoringCase> {
  const { data } = await apiClient.get<AdmMonitoringCase>(
    `/api/adm/my-cases/${caseId}`,
    { signal }
  );
  return data;
}

export async function updateAdmModule(
  caseId: string,
  moduleId: string,
  payload: AdmModulePayload
): Promise<AdmMonitoredModule> {
  const { data } = await apiClient.patch<AdmMonitoredModule>(
    `/api/adm/my-cases/${caseId}/modules/${moduleId}`,
    payload
  );
  return data;
}
