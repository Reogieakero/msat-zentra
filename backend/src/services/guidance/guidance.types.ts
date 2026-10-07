// Shared service-layer contract for the guidance desk services.
// The HTTP layer (modules/guidance/*.routes.ts) resolves the active term /
// school year and builds this from the authenticated request; services never
// touch req/res directly.
export interface GuidanceContext {
  userId: string;
  role: string;
  // Active term id (resolveActiveTermId), or null when none is active.
  // List endpoints that scope by the *session* term instead receive it here
  // too (req.termScope?.termId ?? null) — see each service for which.
  termId: string | null;
  // Session school-year id, or null when unscoped. Overview resolves the
  // legacy active-year fallback in the route before calling the service.
  schoolYearId: string | null;
}
