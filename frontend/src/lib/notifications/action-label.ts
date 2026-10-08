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

function scopeDesk(scope: ActionScope): "nurse" | "guidance_counselor" {
  return scope === "nurse" ? "nurse" : "guidance_counselor";
}

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
  action: string;
  byRole?: string | null;
  withdrawn?: boolean;
  cancelledByRole?: string | null;
  message?: string;
  fallback: string;
}

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
