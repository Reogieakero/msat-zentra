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

// supabase-js calls the token supplier on construction and the realtime client
// sync calls it again right after, so share one in-flight request.
let inflight: { appToken: string; promise: Promise<string | null> } | null = null;

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
  if (inflight && inflight.appToken === appToken) return inflight.promise;
  const promise = (async () => {
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
  })();
  inflight = { appToken, promise };
  try {
    return await promise;
  } finally {
    if (inflight?.promise === promise) inflight = null;
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
  const client = createBrowserClient(
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

  if (!REALTIME_AUTH_ENABLED) return client;

  // Supabase binds a channel's RLS identity when it JOINS. The token is fetched
  // by the `accessToken` callback asynchronously, and `subscribe()` runs
  // synchronously right after `createClient()` in every desk's effect, so the
  // join used to go out before the token arrived — the channel then joined as
  // `anon` and the server rejected every postgres_changes frame with
  // `Error 401: Unauthorized` (pushing `access_token` afterwards does not
  // re-authorize existing bindings). Hold each channel's `subscribe()` until
  // the token is on the socket, so the join payload carries it.
  const authReady = (async () => {
    const token = await getRealtimeToken();
    if (token) await client.realtime.setAuth(token);
  })().catch(() => {
    /* No token (signed out / backend down): fall back to the poll. */
  });

  const openChannel = client.channel.bind(client);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client.channel = ((name: string, params?: any) => {
    const channel = openChannel(name, params);
    const subscribe = channel.subscribe.bind(channel);
    const unsubscribe = channel.unsubscribe.bind(channel);
    // An effect can unmount before the token resolves; never join a channel
    // the desk already tore down.
    let disposed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channel.unsubscribe = ((...args: any[]) => {
      disposed = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (unsubscribe as any)(...args);
    }) as typeof channel.unsubscribe;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channel.subscribe = ((callback?: any, timeout?: number) => {
      void authReady.then(() => {
        if (!disposed) subscribe(callback, timeout);
      });
      return channel;
    }) as typeof channel.subscribe;
    return channel;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  return client;
}

let realtimeClient: ReturnType<typeof createRealtimeClient> | null = null;

/** Realtime client: authenticated with the backend-issued Supabase token when enabled. */
export function createClient() {
  if (!realtimeClient) realtimeClient = createRealtimeClient();
  return realtimeClient;
}
