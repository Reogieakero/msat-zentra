// ADM queue + consultation review for the guidance desk.
import { apiClient } from "@/lib/api/client";
import { asArray } from "@/lib/api/payload";
import type {
  AdmConsultationSession,
  GuidanceAdmData,
  GuidanceAdmParams,
} from "./adm.types";

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
   reject closes the case without ADM action. An optional first session can
   ride an endorsement (same pattern as the nurse ADM review) — standalone
   booking while pending goes through the shared session endpoints. */
export async function reviewAdmConsultation(
  referralId: string,
  input: {
    recommendation: string;
    outcome: "endorse" | "reject";
    scheduledAt?: string;
    sessionType?: string;
    venue?: string;
  }
): Promise<unknown> {
  const { data } = await apiClient.post(
    `/api/guidance/adm/referrals/${referralId}/review`,
    {
      recommendation: input.recommendation,
      outcome: input.outcome,
      ...(input.scheduledAt
        ? {
            clinicSession: {
              scheduledAt: input.scheduledAt,
              sessionType: input.sessionType ?? "individual",
              ...(input.venue?.trim() ? { venue: input.venue.trim() } : {}),
            },
          }
        : {}),
    }
  );
  return data;
}

export async function listAdmConsultationSessions(
  referralId: string
): Promise<AdmConsultationSession[]> {
  const { data } = await apiClient.get<AdmConsultationSession[]>(
    `/api/referrals/${referralId}/sessions`
  );
  return asArray<AdmConsultationSession>(data);
}

export async function bookAdmConsultationSession(
  referralId: string,
  input: { scheduledAt: string; sessionType?: string; venue?: string }
): Promise<unknown> {
  const { data } = await apiClient.post(
    `/api/referrals/${referralId}/sessions`,
    {
      scheduledAt: input.scheduledAt,
      sessionType: input.sessionType ?? "individual",
      ...(input.venue?.trim() ? { venue: input.venue.trim() } : {}),
    }
  );
  return data;
}
