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

/**
 * Auth-capable client (OAuth start + callback session reads).
 *
 * Must NOT carry the `accessToken` option: supabase-js replaces `supabase.auth`
 * with a throwing Proxy whenever a custom token supplier is configured, which
 * would break `signInWithOAuth` and `getSession`. Realtime uses its own dedicated
 * client below.
 */
export function createAuthClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Never let this client become @supabase/ssr's browser singleton: if it
    // did, the realtime client below would silently reuse it (without the
    // token supplier) and every channel would authenticate as `anon` — RLS
    // would then drop every row and the desks would only move on their poll.
    { isSingleton: false },
  );
}

function createRealtimeClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // `createBrowserClient` caches a singleton by default, and whichever
      // client was created first wins. Opt out so this one always carries
      // the `accessToken` supplier and channels are actually authenticated.
      isSingleton: false,
      ...(REALTIME_AUTH_ENABLED ? { accessToken: getRealtimeToken } : {}),
    },
  );
}

let realtimeClient: ReturnType<typeof createRealtimeClient> | null = null;

/** Realtime client: authenticated with the backend-issued Supabase token when enabled. */
export function createClient() {
  if (!realtimeClient) realtimeClient = createRealtimeClient();
  return realtimeClient;
}
