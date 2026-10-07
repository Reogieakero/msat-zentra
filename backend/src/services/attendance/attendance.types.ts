import type { DisplayTerm } from "../../modules/attendance/attendance.repository.js";

// Shared service-layer contract for the attendance services.
// The HTTP layer (modules/attendance/*.routes.ts) resolves terms and builds
// this from the authenticated request; services never touch req/res.
export interface AttendanceContext {
  userId: string;
  role: string;
  // Session term id (req.termScope), or null when unscoped. Write paths
  // combine this with the client-sent term id exactly as before.
  termId: string | null;
  // Session school-year id (req.termScope), or null when unscoped.
  schoolYearId: string | null;
}

export type { DisplayTerm };
