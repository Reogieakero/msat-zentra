// Shared service-layer contract for the auth services.
// The HTTP layer (modules/auth/*.routes.ts) builds this from the
// authenticated request where one exists; public endpoints (register,
// login, refresh) pass userId "" — services that need an actor take it
// explicitly. Services never touch req/res directly.
export interface AuthContext {
  userId: string;
  role: string;
}
