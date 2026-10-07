// Shared service-layer contract for the referral pipeline services.
// The HTTP layer (modules/referrals/*.routes.ts) builds this from the
// authenticated request; services never touch req/res directly.
export interface ReferralContext {
  userId: string;
  role: string;
  // Session term id (req.termScope), or null when unscoped.
  termId: string | null;
}
