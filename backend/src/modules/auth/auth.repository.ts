import type { Role } from "../../generated/prisma/client.js";

// Shared auth policy: self-registrable roles, portal gates, and the
// record-keeper/registrar grade-band claim. Endpoint orchestration lives in
// src/services/auth/*.service.ts.

export const SELF_ROLES: Role[] = ["student", "parent", "subject_teacher", "adviser"];

export const STAFF_ROLES: Role[] = [
  "subject_teacher",
  "adviser",
  "nurse",
  "adm_coordinator",
  "guidance_counselor",
  "record_keeper",
  "registrar",
  "principal",
];

export const KNOWN_ROLES: Role[] = [...STAFF_ROLES, "student", "parent"];

export const roleKindToRoles: Record<string, Role[]> = {
  student: ["student"],
  staff: STAFF_ROLES,
  parent: ["parent"],
};

// Grade-band claim embedded in JWTs: record keepers own grades 7–10,
// registrars own 11–12, everyone else carries no band.
export function gradeBandForRole(role: string): "7-10" | "11-12" | null {
  if (role === "record_keeper") return "7-10";
  if (role === "registrar") return "11-12";
  return null;
}
