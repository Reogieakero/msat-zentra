// Shared service-layer contract for the ADM desk services.
// The HTTP layer (modules/adm/*.routes.ts) builds this from the
// authenticated request; services never touch req/res directly.
export interface AdmContext {
  userId: string;
  role: string;
  // Active School Year + Term id, resolved by the route via
  // req.termScope (with scopedTermRow fallback where the original
  // handler used one). Null = unscoped.
  termId: string | null;
}
