// Shared service-layer contract for the teacher workspace services.
// The HTTP layer (modules/teacher/*.routes.ts) resolves the active term and
// builds this from the authenticated request; services never touch req/res.
export interface TeacherContext {
  userId: string;
  role: string;
  // Active term id (resolveActiveTermId), or null when none is active.
  termId: string | null;
  // Session school-year id (req.termScope), or null when unscoped.
  schoolYearId: string | null;
}
