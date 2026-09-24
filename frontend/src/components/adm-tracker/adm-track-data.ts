// Shared ADM referral tracker — mirrors the backend 8-stage ADM Case
// Pipeline in backend/src/services/adm.ts (ADM_STAGE_FLOW). Both the
// guidance (/guidance/adm) and nurse (/nurse/adm) "Latest referred ADM
// cases" tables map their rows onto AdmTrackInput so the timeline always
// starts from the adviser's anecdotal filing and routes through the picked
// consultation reviewer (nurse / guidance / LRPC).

export type AdmTrackStageKey =
  | "anecdotal"
  | "consultation"
  | "meeting_parents"
  | "home_visitation"
  | "certification"
  | "principal_approval"
  | "enrollment_monitoring"
  | "completion";

export interface AdmTrackPipelineMeta {
  stage: AdmTrackStageKey;
  order: number;
  label: string;
  owner: string;
  description: string;
}

export const ADM_TRACK_PIPELINE: AdmTrackPipelineMeta[] = [
  {
    stage: "anecdotal",
    order: 1,
    label: "Anecdotal Report Filed",
    owner: "Adviser",
    description: "Adviser files the anecdotal report documenting the learner's concern.",
  },
  {
    stage: "consultation",
    order: 2,
    label: "Consultation & Referral",
    owner: "Guidance / Nurse / LRPC",
    description: "Routed to the Guidance Counselor, School Nurse, or LRPC for review.",
  },
  {
    stage: "meeting_parents",
    order: 3,
    label: "Meeting with Parents/Guardians",
    owner: "ADM Coordinator & Teachers",
    description:
      "Meeting with parents/guardians. Attended → minutes logged; otherwise → home visitation.",
  },
  {
    stage: "home_visitation",
    order: 4,
    label: "Home Visitation (if no meeting)",
    owner: "Guidance Counselor",
    description:
      "Conducted only when parents did not attend the meeting. Both branches converge at certification.",
  },
  {
    stage: "certification",
    order: 5,
    label: "Recommendation & Certification",
    owner: "ADM Coordinator",
    description:
      "ADM Coordinator records the recommendation and issues the ADM certification.",
  },
  {
    stage: "principal_approval",
    order: 6,
    label: "School Head (Principal) Approval",
    owner: "Principal",
    description: "Principal signs the certification and authorizes module release and monitoring.",
  },
  {
    stage: "enrollment_monitoring",
    order: 7,
    label: "Enrollment Monitoring",
    owner: "ADM Coordinator",
    description: "Coordinator and teacher track attendance and module submissions.",
  },
  {
    stage: "completion",
    order: 8,
    label: "Completion & Case Closed",
    owner: "ADM Coordinator",
    description: "Device return recorded; the ADM case is closed.",
  },
];

export const ADM_TRACK_ORDER: AdmTrackStageKey[] = ADM_TRACK_PIPELINE.map((s) => s.stage);

export const CONSULT_REVIEWER_LABELS: Record<string, string> = {
  nurse: "School Nurse",
  guidance_counselor: "Guidance Counselor",
  lrpc: "LRPC",
  adm_coordinator: "ADM Coordinator",
};

export interface AdmTrackInput {
  /** Backend pipeline stage (defaults to "consultation" for early referrals). */
  stage?: string | null;
  /** Raw referral status: pending | in_progress | dismissed | resolved | … */
  referralStatus?: string | null;
  /** Teacher-picked consultation reviewer (nurse | guidance_counselor | lrpc). */
  consultReviewer?: string | null;
  /** Adviser who filed the anecdotal report. */
  referredBy?: string | null;
  /** Observation date of the anecdotal report (YYYY-MM-DD or ISO). */
  anecdotalDate?: string | null;
  /** When the case was referred onward (YYYY-MM-DD or ISO). */
  referredDate?: string | null;
  meetingAttended?: boolean | null;
  hasHomeVisit?: boolean;
  approved?: boolean;
  approvedAt?: string | null;
}

export type AdmTrackState = "done" | "current" | "todo";

export interface AdmTrackStep extends AdmTrackPipelineMeta {
  state: AdmTrackState;
  /** One-line truthful status for this step (who + what happened). */
  detail: string;
}

function normalizeStage(stage?: string | null): AdmTrackStageKey {
  if (stage && (ADM_TRACK_ORDER as string[]).includes(stage)) {
    return stage as AdmTrackStageKey;
  }
  return "consultation";
}

export function reviewerLabel(consultReviewer?: string | null): string {
  if (!consultReviewer) return "Guidance / Nurse / LRPC";
  return CONSULT_REVIEWER_LABELS[consultReviewer] ?? consultReviewer;
}

function shortDate(value?: string | null): string {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) {
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    return `${months[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}, ${m[1]}`;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Build the 8-step tracker from a queue row. Rules:
 * - Anecdotal is always done: the case starts with the adviser filing it.
 * - Early referrals (no learner profile yet) sit at consultation.
 * - Endorsed (in_progress) means consultation is done and the case is with
 *   the coordinator for the parent meeting.
 * - Dismissed closes at consultation with a rejected marker; later steps
 *   stay todo. Resolved/completion marks every step done.
 */
export function buildAdmTrackSteps(input: AdmTrackInput): AdmTrackStep[] {
  const status = (input.referralStatus ?? "").toLowerCase();
  const dismissed = status === "dismissed";
  const resolved = status === "resolved";
  const endorsed = status === "in_progress";

  let stage = normalizeStage(input.stage);
  // Nurse / early rows carry no profile stage yet: derive it from status.
  if (!input.stage) {
    if (resolved) stage = "completion";
    else if (endorsed) stage = "meeting_parents";
    else stage = "consultation";
  }
  if (resolved) stage = "completion";
  // Endorsed (in_progress) means consultation is done even when the row
  // still carries the explicit "consultation" stage (early guidance/nurse
  // queue rows) — advance to the parent meeting so step 2 checks off and
  // step 3 becomes current. Never drags later profile stages backwards.
  if (endorsed && ADM_TRACK_ORDER.indexOf(stage) < ADM_TRACK_ORDER.indexOf("meeting_parents")) {
    stage = "meeting_parents";
  }

  const currentIdx = Math.max(0, ADM_TRACK_ORDER.indexOf(stage));
  const reviewer = reviewerLabel(input.consultReviewer);
  const filedBy = (input.referredBy ?? "").trim() || "Adviser";
  const anecdotalDate = shortDate(input.anecdotalDate ?? input.referredDate);
  const referredDate = shortDate(input.referredDate ?? input.anecdotalDate);

  const homeSkipped =
    !input.hasHomeVisit && input.meetingAttended === true && currentIdx > ADM_TRACK_ORDER.indexOf("home_visitation");

  const stateAt = (idx: number): AdmTrackState => {
    if (dismissed) return idx === 0 ? "done" : idx === 1 ? "current" : "todo";
    if (resolved || stage === "completion") return "done";
    if (idx < currentIdx) return "done";
    if (idx === currentIdx) return "current";
    return "todo";
  };

  const details: Record<AdmTrackStageKey, string> = {
    anecdotal: `Filed by ${filedBy} · ${anecdotalDate}`,
    consultation: dismissed
      ? `Reviewed by ${reviewer} · Rejected`
      : endorsed || currentIdx > 1
        ? `Reviewed by ${reviewer} · Endorsed to coordinator`
        : `With ${reviewer} · Referred ${referredDate}`,
    meeting_parents:
      input.meetingAttended === true
        ? "Parents attended · Minutes logged"
        : currentIdx > ADM_TRACK_ORDER.indexOf("meeting_parents") || endorsed
          ? "With coordinator"
          : "Waiting on parent meeting",
    home_visitation: input.hasHomeVisit
      ? "Home visit done"
      : homeSkipped
        ? "Skipped · Parents attended"
        : "Only if parents did not attend",
    certification:
      currentIdx >= ADM_TRACK_ORDER.indexOf("certification") && !dismissed
        ? "Coordinator building the file"
        : "Pending issuance",
    principal_approval: input.approved
      ? `Signed · ${shortDate(input.approvedAt)}`
      : "Pending principal signature",
    enrollment_monitoring:
      currentIdx > ADM_TRACK_ORDER.indexOf("enrollment_monitoring") || resolved
        ? "Tracking submissions"
        : "Pending",
    completion: dismissed
      ? "Closed · Rejected from ADM"
      : resolved || stage === "completion"
        ? "Done"
        : "Pending",
  };

  return ADM_TRACK_PIPELINE.map((meta, idx) => ({
    ...meta,
    // Consultation shows the picked reviewer as the owner so it is clear
    // the case went to the nurse or to guidance — never both.
    owner: meta.stage === "consultation" ? reviewer : meta.owner,
    state: stateAt(idx),
    detail: details[meta.stage],
  }));
}

export function admTrackSummary(input: AdmTrackInput): { stepText: string; holder: string } {
  const steps = buildAdmTrackSteps(input);
  const current = steps.find((s) => s.state === "current") ?? steps[steps.length - 1];
  if ((input.referralStatus ?? "").toLowerCase() === "dismissed") {
    return { stepText: `Rejected at step 2 of 8 · ${current.label}`, holder: current.owner };
  }
  return { stepText: `Step ${current.order} of 8 · ${current.label}`, holder: current.owner };
}
