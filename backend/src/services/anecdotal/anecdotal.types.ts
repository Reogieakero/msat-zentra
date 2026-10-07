// Shared service-layer contract for the anecdotal desk services.
// The HTTP layer (modules/anecdotal/*.routes.ts) builds this from the
// authenticated request; services never touch req/res directly.
export interface AnecdotalContext {
  userId: string;
  role: string;
  // Session term id (req.termScope), or null when unscoped. Filing falls
  // back to the client-sent term id exactly as before.
  termId: string | null;
}
