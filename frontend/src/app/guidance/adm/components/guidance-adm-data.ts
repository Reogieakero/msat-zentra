import { apiClient } from "@/lib/api/client";

export type GuidanceAdmStageFilter =
  | ""
  | "consultation"
  | "meeting_parents"
  | "home_visitation"
  | "certification"
  | "principal_approval"
  | "enrollment_monitoring"
  | "completion";

export interface GuidanceAdmCase {
  id: string;
  student: string;
  lrn: string;
  section: string;
  grade: string;
  stage: string;
  stageLabel: string;
  eligibility: string;
  referralId: string;
  referralStatus: string;
  reason: string;
  referredBy: string;
  preparedBy: string;
  date: string;
  meetingAttended: boolean | null;
  hasHomeVisit: boolean;
  approved: boolean;
  approvedAt: string | null;
  /* Consultation-review context (early ADM referrals only): the linked
     anecdotal id so the counselor can open the official report, plus whether
     this case was already decided out of the consultation stage. */
  anecdotalId?: string;
  /* Teacher-picked consultation reviewer — this queue only ever carries
     guidance-picked (or legacy unpicked) cases. */
  consultReviewer?: string;
  category?: string;
  anecdotalExcerpt?: string;
  location?: string;
  recommendations?: string;
  reviewed?: boolean;
}

export interface GuidanceAdmSummary {
  total: number;
  consultation: number;
  meetingParents: number;
  homeVisitation: number;
  certification: number;
  principalApproval: number;
  needsHomeVisit: number;
  awaitingReview: number;
  consultationAction: number;
}

/* One open guidance referral waiting on the counselor's consultation action.
   Counsel here first — handing off moves it to the ADM coordinator. */
export interface GuidanceAdmConsultationCase {
  id: string;
  student: string;
  lrn: string;
  section: string;
  grade: string;
  category: string;
  reason: string;
  status: string;
  priority: string;
  referredBy: string;
  date: string;
  completedSessions: number;
  totalSessions: number;
}

export interface GuidanceAdmData {
  summary: GuidanceAdmSummary;
  counselorName: string;
  consultationQueue: GuidanceAdmConsultationCase[];
  /* Latest ADM cases referred to guidance still needing review (top section). */
  reviewQueue: GuidanceAdmCase[];
  cases: GuidanceAdmCase[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface GuidanceAdmParams {
  q?: string;
  stage?: GuidanceAdmStageFilter;
  page?: number;
  pageSize?: number;
}

export async function fetchGuidanceAdm(
  params: GuidanceAdmParams = {}
): Promise<GuidanceAdmData> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.stage) search.set("stage", params.stage);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  const query = search.toString();
  const { data } = await apiClient.get<GuidanceAdmData>(
    `/api/guidance/adm${query ? `?${query}` : ""}`
  );
  return data;
}

/* Consultation review on an ADM-purpose referral at the consultation stage:
   endorse creates the referral forward to the coordinator's parent meeting,
   reject closes the case without ADM action. */
export async function reviewAdmConsultation(
  referralId: string,
  input: { recommendation: string; outcome: "endorse" | "reject" }
): Promise<unknown> {
  const { data } = await apiClient.post(
    `/api/guidance/adm/referrals/${referralId}/review`,
    input
  );
  return data;
}
