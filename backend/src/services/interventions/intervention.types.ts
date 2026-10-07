// Shared service-layer contract for the intervention follow-up services.
// The HTTP layer (modules/interventions/*.routes.ts) builds this from the
// authenticated request; services never touch req/res directly.
export interface InterventionContext {
  userId: string;
  role: string;
  // Session term id (req.termScope), or null when unscoped.
  termId: string | null;
}
