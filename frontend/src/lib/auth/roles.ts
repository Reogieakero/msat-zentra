export const ROLES = [
  "student",
  "parent",
  "subject_teacher",
  "adviser",
  "nurse",
  "adm_coordinator",
  "guidance_counselor",
  "record_keeper",
  "registrar",
  "principal",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  student: "Student",
  parent: "Parent / Guardian",
  subject_teacher: "Subject Teacher",
  adviser: "Adviser",
  nurse: "School Nurse",
  adm_coordinator: "ADM Coordinator",
  guidance_counselor: "Guidance Counselor",
  record_keeper: "Record Keeper",
  registrar: "Registrar",
  principal: "Principal",
};

export function roleLabel(role: string): string {
  return (ROLE_LABELS as Record<string, string>)[role] ?? role;
}

/**
 * Teacher-role helpers.
 *
 * The business rule: only teacher roles (subject_teacher / adviser) select a
 * term and carry it on their requests. Every other role is scoped
 * server-side and must never read or depend on a client-selected term.
 */

export function isTeacherRole(role: string | null | undefined): boolean {
  return role === "subject_teacher" || role === "adviser";
}

export interface TokenIdentity {
  sub: string;
  role: string;
  gradeBand: "7-10" | "11-12" | null;
}

/** Decodes the access-token payload; null when absent/malformed. */
export function decodeTokenIdentity(token: string | null): TokenIdentity | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1])) as {
      sub?: unknown;
      role?: unknown;
      gradeBand?: unknown;
    };
    if (typeof payload.sub !== "string" || typeof payload.role !== "string") {
      return null;
    }
    return {
      sub: payload.sub,
      role: payload.role,
      gradeBand:
        payload.gradeBand === "7-10" || payload.gradeBand === "11-12"
          ? payload.gradeBand
          : null,
    };
  } catch {
    return null;
  }
}
