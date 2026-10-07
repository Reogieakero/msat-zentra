// Shared service-layer contract for the SF10 services.
// The HTTP layer (modules/sf10/*.routes.ts) builds this from the
// authenticated request; services never touch req/res directly.
export interface Sf10Context {
  userId: string;
  role: string;
}
