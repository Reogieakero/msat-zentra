import { createBrowserClient } from "@supabase/ssr";
import { apiClient } from "@/lib/api/client";

// Phase 3 realtime privacy (opt-in). When enabled, the browser authenticates to
// Supabase Realtime with a short-lived, Supabase-format token from the backend,
// so RLS on "Notification" can scope delivery to the signed-in user. Off by
// default so nothing changes until the Supabase project's JWT secret is aligned
// with the backend JWT_ACCESS_SECRET. See NURSE_NOTIFICATION_REPORT.md.
const REALTIME_AUTH_ENABLED =
  process.env.NEXT_PUBLIC_SUPABASE_REALTIME_AUTH === "true";

// Cache the token but key it to the current app access token, so a
// login/logout/user-switch silently invalidates it.
let cached: { appToken: string | null; token: string; expiresAt: number } | null = null;

function currentAppToken(): string | null {
  try {
    return window.localStorage.getItem("zentra.access");
  } catch {
    return null;
  }
}

async function getRealtimeToken(): Promise<string | null> {
  const appToken = currentAppToken();
  if (!appToken) return null;
  const now = Date.now();
  if (cached && cached.appToken === appToken && cached.expiresAt - 30_000 > now) {
    return cached.token;
  }
  try {
    const { data } = await apiClient.get<{ token: string; expiresIn: number }>(
      "/api/auth/realtime-token",
    );
    if (!data?.token) return null;
    cached = {
      appToken,
      token: data.token,
      expiresAt: now + (data.expiresIn ?? 900) * 1000,
    };
    return cached.token;
  } catch {
    return null;
  }
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    REALTIME_AUTH_ENABLED ? { accessToken: getRealtimeToken } : {},
  );
}
