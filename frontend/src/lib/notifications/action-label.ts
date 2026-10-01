/* Actor-attributed action labels — one wording shared by the nurse alerts
   timeline, the guidance timelines, the teacher toasts/bell, and the
   adviser tracking stages. Every label names WHO acted (actor-first):
   "Cancelled by adviser", "Session booked by School Nurse", ...
   Unknown/absent actors fall back to the caller's legacy text so legacy
   rows never go blank. */

export type ActionScope = "nurse" | "guidance" | "teacher";

const DESK_NAMES: Record<string, string> = {
  nurse: "School Nurse",
  guidance_counselor: "Guidance Counselor",
  adm_coordinator: "ADM Coordinator",
  principal: "Principal",
  adviser: "Adviser",
  subject_teacher: "Adviser",
};

export function isFilingTeacher(role: string | null | undefined): boolean {
  return role === "adviser" || role === "subject_teacher";
}

function deskName(role: string | null | undefined): string | null {
  if (!role) return null;
  return DESK_NAMES[role] ?? null;
}

/** Owning desk of the scope — the actor for every non-withdrawal action
 *  the desk performs on its own timeline (route scoping guarantees it). */
function scopeDesk(scope: ActionScope): "nurse" | "guidance_counselor" {
  return scope === "nurse" ? "nurse" : "guidance_counselor";
}

/** Which desk ran a session event described by a teacher-facing message
 *  ("Clinic booked a session …" vs "Guidance booked …" vs intervention
 *  follow-ups, which are always guidance-run). Null when unknowable. */
export function deskFromSessionMessage(
  message: string | null | undefined
): "nurse" | "guidance_counselor" | null {
  const msg = message ?? "";
  if (/clinic (booked|completed|rescheduled|cancelled) a session/i.test(msg)) {
    return "nurse";
  }
  if (
    /guidance (booked|completed|rescheduled) a session/i.test(msg) ||
    /guidance cancelled/i.test(msg) ||
    /follow-up session/i.test(msg)
  ) {
    return "guidance_counselor";
  }
  return null;
}

export interface ActorActionInput {
  scope: ActionScope;
  /** Raw audit action (referral_dismissed, session_scheduled, …). */
  action: string;
  /** Actor role behind the action (audit). Null when unknown. */
  byRole?: string | null;
  /** Referral dismissal performed by the filing teacher. */
  withdrawn?: boolean;
  /** Role behind a session cancel (exact audit role, incl. the adviser
   *  withdrawal cascade). Null when never cancelled / unknown. */
  cancelledByRole?: string | null;
  /** Original message for teacher-scope desk derivation. */
  message?: string;
  /** Fallback when the action maps to nothing (alert title, status text). */
  fallback: string;
}

/** Full actor-first label for one audit action. */
export function actorActionLabel(input: ActorActionInput): string {
  const { scope, action } = input;
  const desk = scopeDesk(scope);
  const by = (role: string | null | undefined, orDesk = true): string | null => {
    const named = deskName(role);
    if (named) return named;
    if (orDesk && scope !== "teacher") return DESK_NAMES[desk];
    return null;
  };
  const withActor = (text: string, actor: string | null): string =>
    actor ? `${text} by ${actor}` : input.fallback;
  // Explicit audit actor wins everywhere (tracker entries carry it; desk
  // timelines infer it from scope when absent).
  const explicit = by(input.byRole, false);

  switch (action) {
    case "referral_dismissed": {
      if (input.withdrawn || isFilingTeacher(input.byRole)) return "Cancelled by adviser";
      const actor = explicit;
      return actor ? `Rejected by ${actor}` : "Rejected";
    }
    case "session_scheduled":
      return withActor("Session booked", explicit ?? (scope === "teacher"
        ? by(deskFromSessionMessage(input.message), false)
        : by(desk)));
    case "session_completed":
      return withActor("Session done", explicit ?? (scope === "teacher"
        ? by(deskFromSessionMessage(input.message), false)
        : by(desk)));
    case "session_rescheduled":
      return withActor("Session moved", explicit ?? (scope === "teacher"
        ? by(deskFromSessionMessage(input.message), false)
        : by(desk)));
    case "session_cancelled": {
      const canceller = input.cancelledByRole ?? input.byRole;
      if (isFilingTeacher(canceller)) return "Cancelled by adviser";
      const named = by(canceller, false);
      if (named) return `Session cancelled by ${named}`;
      if (scope !== "teacher") return `Session cancelled by ${DESK_NAMES[desk]}`;
      const fromMsg = by(deskFromSessionMessage(input.message), false);
      return fromMsg ? `Session cancelled by ${fromMsg}` : "Session cancelled";
    }
    case "session_document_added":
      return withActor("Documentation filed", explicit ?? (scope === "teacher" ? null : by(desk)));
    case "referral_accepted":
      return withActor("Accepted", explicit ?? (scope === "teacher" ? null : by(desk)));
    case "referral_follow_up":
      return withActor("Marked for follow-up", explicit ?? (scope === "teacher" ? null : by(desk)));
    case "referral_note_added":
      return withActor("Note added", explicit ?? (scope === "teacher" ? null : by(desk)));
    case "referral_escalated":
      return withActor("Sent to clinic", explicit ?? (scope === "teacher" ? null : by(desk)));
    case "referral_reassigned":
      return withActor("Passed to someone else", explicit ?? (scope === "teacher" ? null : by(desk)));
    case "referral_referred_specialist":
      return withActor("Specialist asked", explicit ?? (scope === "teacher" ? null : by(desk)));
    case "referral_adm_initiated":
      return withActor("ADM process started", explicit ?? (scope === "teacher" ? null : by(desk)));
    default:
      return input.fallback;
  }
}
