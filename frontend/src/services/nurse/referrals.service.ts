import { apiClient } from "@/lib/api/client";
import type {
  NurseAcceptInput,
  NurseAdmReferralForm,
  NurseReferralDraft,
  NurseReferralStatus,
  SavedNurseAdmForm,
} from "./nurse.types";

export async function acceptNurseCase(id: string, input: NurseAcceptInput): Promise<void> {
  const body: Record<string, unknown> = {};
  if (input.intakeNotes?.trim()) body.intakeNotes = input.intakeNotes.trim();
  if (input.scheduledAt) {
    body.clinicSession = {
      scheduledAt: input.scheduledAt,
      ...(input.venue?.trim() ? { venue: input.venue.trim() } : {}),
    };
  }
  await apiClient.post(`/api/referrals/${id}/nurse-accept`, body);
}

export async function reviewNurseAdmCase(
  id: string,
  input: { recommendation: string; outcome: "endorse" | "reject"; scheduledAt?: string; venue?: string; referralForm?: NurseAdmReferralForm },
): Promise<void> {
  const body: Record<string, unknown> = {
    recommendation: input.recommendation,
    outcome: input.outcome,
  };
  if (input.scheduledAt) {
    body.clinicSession = {
      scheduledAt: input.scheduledAt,
      ...(input.venue?.trim() ? { venue: input.venue.trim() } : {}),
    };
  }
  const form = buildReferralFormBody(input.referralForm);
  if (form) body.referralForm = form;
  await apiClient.post(`/api/referrals/${id}/nurse-adm-review`, body);
}

function buildReferralFormBody(input: NurseAdmReferralForm | undefined): Record<string, unknown> | null {
  if (!input) return null;
  const form: Record<string, unknown> = {};
  if (input.concerns?.length) form.concerns = input.concerns;
  if (input.detailsOfConcern?.trim()) form.detailsOfConcern = input.detailsOfConcern.trim();
  if (input.nurseActions?.trim()) form.nurseActions = input.nurseActions.trim();
  if (input.followUp?.trim()) form.followUp = input.followUp.trim();
  return Object.keys(form).length > 0 ? form : null;
}

export async function saveNurseReferralForm(
  id: string,
  input: { recommendation: string; scheduledAt?: string; venue?: string; referralForm?: NurseAdmReferralForm },
): Promise<void> {
  const body: Record<string, unknown> = {
    recommendation: input.recommendation,
  };
  if (input.scheduledAt) {
    body.clinicSession = {
      scheduledAt: input.scheduledAt,
      ...(input.venue?.trim() ? { venue: input.venue.trim() } : {}),
    };
  }
  const form = buildReferralFormBody(input.referralForm);
  if (form) body.referralForm = form;
  await apiClient.post(`/api/referrals/${id}/nurse-referral-form`, body);
}

export async function forwardNurseAdmCase(id: string): Promise<void> {
  await apiClient.post(`/api/referrals/${id}/nurse-adm-forward`);
}

export async function confirmNurseReferralAndEndorse(
  id: string,
  input: { recommendation: string; scheduledAt?: string; venue?: string; referralForm?: NurseAdmReferralForm },
): Promise<void> {
  await saveNurseReferralForm(id, input);
  await forwardNurseAdmCase(id);
}

function parseAdmFormParts(body: string): SavedNurseAdmForm {
  const out: SavedNurseAdmForm = {
    recommendation: "",
    concerns: [],
    details: "",
    actions: "",
    followUp: "",
  };

  let current: "recommendation" | "details" | "actions" | "followUp" | "concerns" = "recommendation";
  const appendText = (key: "recommendation" | "details" | "actions" | "followUp", value: string) => {
    out[key] = out[key] ? `${out[key]} | ${value}` : value;
  };
  for (const segment of body.split(" | ")) {
    const t = segment.trim();
    if (!t) continue;
    if (t.startsWith("Concerns:")) {
      current = "concerns";
      out.concerns = t
        .slice("Concerns:".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (t.startsWith("Details:")) {
      current = "details";
      out.details = t.slice("Details:".length).trim();
    } else if (t.startsWith("Actions taken:")) {
      current = "actions";
      out.actions = t.slice("Actions taken:".length).trim();
    } else if (t.startsWith("Follow-up:")) {
      current = "followUp";
      out.followUp = t.slice("Follow-up:".length).trim();
    } else if (current === "concerns") {
      const last = out.concerns[out.concerns.length - 1];
      out.concerns[out.concerns.length - 1] = last ? `${last} | ${t}` : t;
    } else {
      appendText(current, t);
    }
  }
  out.recommendation = out.recommendation.trim();
  return out;
}

export function parseSavedNurseAdmForm(notes: string | null | undefined): SavedNurseAdmForm | null {
  if (!notes) return null;
  const lines = notes
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const endorsed = [...lines].reverse().find((l) => l.startsWith("[ADM endorsed]"));
  if (endorsed) {
    const parsed = parseAdmFormParts(endorsed.slice("[ADM endorsed]".length).trim());
    return parsed.recommendation ? parsed : null;
  }
  const consult = [...lines].reverse().find((l) => l.startsWith("[ADM consult]"));
  if (!consult) return null;
  const recommendation = consult.slice("[ADM consult]".length).trim();
  const referralLine = [...lines].reverse().find((l) => l.startsWith("[ADM referral]"));
  const parts = referralLine
    ? parseAdmFormParts(referralLine.slice("[ADM referral]".length).trim())
    : null;
  return {
    recommendation,
    concerns: parts?.concerns ?? [],
    details: parts?.details ?? "",
    actions: parts?.actions ?? "",
    followUp: parts?.followUp ?? "",
  };
}

export async function updateNurseReferralStatus(
  id: string,
  status: NurseReferralStatus,
  resolutionSummary?: string,
): Promise<void> {
  await apiClient.post(
    `/api/referrals/${id}/status`,
    resolutionSummary ? { status, resolutionSummary } : { status },
  );
}

export async function addNurseFollowUpNote(anecdotalId: string, notes: string): Promise<void> {
  await apiClient.post(`/api/anecdotal/${anecdotalId}/followups`, { notes });
}

export const NURSE_REFERRAL_DRAFT_KEY = "zentra.nurse-adm-referral-draft";

export function saveNurseReferralDraft(draft: NurseReferralDraft): void {
  try {
    window.sessionStorage.setItem(NURSE_REFERRAL_DRAFT_KEY, JSON.stringify(draft));
  } catch {

  }
}

export function loadNurseReferralDraft(): NurseReferralDraft | null {
  try {
    const raw = window.sessionStorage.getItem(NURSE_REFERRAL_DRAFT_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(NURSE_REFERRAL_DRAFT_KEY);
    const parsed = JSON.parse(raw) as Partial<NurseReferralDraft>;
    if (parsed && typeof parsed.recommendation === "string") {
      return {
        recommendation: parsed.recommendation,
        ...(typeof parsed.scheduledAt === "string" ? { scheduledAt: parsed.scheduledAt } : {}),
      };
    }
    return null;
  } catch {
    return null;
  }
}
