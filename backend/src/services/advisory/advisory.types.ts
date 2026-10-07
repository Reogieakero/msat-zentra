// Shared service-layer contract for the advisory desk services.
// The HTTP layer (modules/teacher/advisory.*.routes.ts) resolves the active
// term / school year and builds this from the authenticated request;
// services never touch req/res directly.
export interface AdvisoryContext {
  userId: string;
  role: string;
  // Active term id (resolveActiveTermId), or null when none is active.
  termId: string | null;
  // Session school-year id (req.termScope), or null when unscoped.
  schoolYearId: string | null;
}
