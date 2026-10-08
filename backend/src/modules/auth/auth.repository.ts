import type { Role } from "../../generated/prisma/client.js";
import {
  KNOWN_ROLES as KNOWN,
  SELF_ROLES as SELF,
  STAFF_ROLES as STAFF,
  gradeBandForRole as bandForRole,
} from "../../lib/roles.js";

export const SELF_ROLES = SELF;

export const STAFF_ROLES = STAFF;

export const KNOWN_ROLES = KNOWN;

export const roleKindToRoles: Record<string, Role[]> = {
  student: ["student"],
  staff: STAFF_ROLES,
  parent: ["parent"],
};

export function gradeBandForRole(role: string): "7-10" | "11-12" | null {
  return bandForRole(role);
}
