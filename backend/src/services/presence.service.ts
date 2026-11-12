import type { Request } from "express";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/pino.js";

/**
 * Presence tracking for the administrator globe.
 *
 * Every login/refresh stores the caller's IP (when it is a real, routable
 * address) and geolocates it once; every authenticated request bumps
 * `lastActiveAt` at most once a minute. The admin presence endpoint then plots
 * everyone active in the last 5 minutes.
 *
 * Everything here is best-effort: presence must never fail a real request.
 */

const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
const TOUCH_INTERVAL_MS = 60 * 1000;
const GEO_TIMEOUT_MS = 1500;
const MAX_GEO_CACHE = 5_000;

export interface GeoPoint {
  city: string | null;
  country: string | null;
  lat: number;
  lng: number;
}

// Mati, Davao Oriental — the school's home. Used as the anchor for simulated
// coordinates when an address cannot be geolocated (localhost / private LAN).
const SCHOOL_ANCHOR = { lat: 6.9533, lng: 126.2167 };

/** Loopback, link-local, and RFC1918 addresses that can never be geolocated. */
function isPrivateIp(ip: string): boolean {
  if (ip === "::1" || ip === "127.0.0.1") return true;
  if (ip.startsWith("127.") || ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.") || ip.startsWith("169.254.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80:")) return true;
  return false;
}

/**
 * The caller's public address, or `null` when the request came from the local
 * machine / a private network (in which case there is nothing to geolocate).
 */
export function clientIp(req: Request): string | null {
  const raw = req.ip ?? req.socket.remoteAddress ?? "";
  // Express may report IPv4 as "::ffff:127.0.0.1"; proxied requests can carry a
  // comma-separated hop list (trust proxy is configured in app.ts).
  const first = raw.split(",")[0].trim().replace(/^::ffff:/i, "");
  if (!first || isPrivateIp(first)) return null;
  return first;
}

const geoCache = new Map<string, GeoPoint | null>();

/** Resolve an IP to an approximate location. Cached for the process lifetime. */
export async function resolveGeo(ip: string): Promise<GeoPoint | null> {
  if (geoCache.has(ip)) return geoCache.get(ip) ?? null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEO_TIMEOUT_MS);
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`geo ${res.status}`);
    const body = (await res.json()) as {
      success?: boolean;
      city?: string;
      country?: string;
      latitude?: number;
      longitude?: number;
    };
    if (!body.success || typeof body.latitude !== "number" || typeof body.longitude !== "number") {
      geoCache.set(ip, null);
      return null;
    }
    const geo: GeoPoint = {
      city: body.city ?? null,
      country: body.country ?? null,
      lat: body.latitude,
      lng: body.longitude,
    };
    if (geoCache.size > MAX_GEO_CACHE) geoCache.clear();
    geoCache.set(ip, geo);
    return geo;
  } catch {
    // Fail-open and cache the miss so a flaky provider does not slow every
    // admin poll. The globe falls back to simulated coordinates.
    geoCache.set(ip, null);
    return null;
  }
}

/**
 * Record a successful sign-in. The IP + timestamp land immediately; the
 * geolocation is filled in afterwards so login latency is never tied to the
 * external provider. `isSignIn` is false for silent token refreshes so the
 * login-activity chart only counts real sign-ins.
 */
export async function recordLogin(
  userId: string,
  ip: string | null,
  isSignIn = true,
): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastActiveAt: new Date(),
        ...(ip ? { lastIp: ip } : {}),
      },
    });
    if (isSignIn) {
      await prisma.loginEvent.create({ data: { userId, ip, kind: "login" } });
    }
  } catch (error) {
    logger.warn({ err: error }, "presence: could not record login");
    return;
  }

  if (!ip) return;
  void (async () => {
    const geo = await resolveGeo(ip);
    if (!geo) return;
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          lastCity: geo.city,
          lastCountry: geo.country,
          lastLat: geo.lat,
          lastLng: geo.lng,
        },
      });
    } catch {
      // Presence is best-effort.
    }
  })();
}

/** Record an explicit sign-out for the activity chart. Best-effort. */
export async function recordLogout(userId: string, ip: string | null): Promise<void> {
  try {
    await prisma.loginEvent.create({ data: { userId, ip, kind: "logout" } });
  } catch (error) {
    logger.warn({ err: error }, "presence: could not record sign-out");
  }
}

const lastTouch = new Map<string, number>();

/**
 * Drop a user from the presence board the moment they log out, instead of
 * letting their dot linger until the 5-minute activity window expires. The
 * refresh heartbeat stops with the cookie, so nothing re-adds it.
 */
export function clearPresence(userId: string): void {
  lastTouch.delete(userId);
  void prisma.user
    .update({ where: { id: userId }, data: { lastActiveAt: null } })
    .catch(() => {
      // Presence is best-effort; a deleted user simply has nothing to clear.
    });
}

/**
 * Bump `lastActiveAt` for an authenticated request, at most once a minute per
 * user. Fire-and-forget: callers never await this.
 */
export function touchActivity(userId: string): void {
  const now = Date.now();
  if (now - (lastTouch.get(userId) ?? 0) < TOUCH_INTERVAL_MS) return;
  if (lastTouch.size > 20_000) lastTouch.clear();
  lastTouch.set(userId, now);
  void prisma.user
    .update({ where: { id: userId }, data: { lastActiveAt: new Date() } })
    .catch(() => {
      // The user may have been deleted between auth and this write.
    });
}

/** Deterministic pseudo-location around the school, seeded by user id. */
function pseudoLocation(seed: string): { lat: number; lng: number } {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const a = (hash & 0xffff) / 0xffff;
  const b = ((hash >>> 16) & 0xffff) / 0xffff;
  return {
    lat: SCHOOL_ANCHOR.lat + (a - 0.5) * 1.8,
    lng: SCHOOL_ANCHOR.lng + (b - 0.5) * 1.8,
  };
}

export interface ActivePresenceRow {
  id: string;
  fullName: string;
  role: string;
  ip: string | null;
  city: string | null;
  country: string | null;
  lat: number;
  lng: number;
  lastActiveAt: string;
  approximate: boolean;
}

export interface ActivePresenceResult {
  active: ActivePresenceRow[];
  generatedAt: string;
  approximate: boolean;
  windowMinutes: number;
}

/** Everyone active within the last 5 minutes, with a plotted coordinate. */
export async function listActivePresence(): Promise<ActivePresenceResult> {
  const since = new Date(Date.now() - ACTIVE_WINDOW_MS);
  const users = await prisma.user.findMany({
    where: { status: "active", lastActiveAt: { gte: since } },
    select: {
      id: true,
      fullName: true,
      role: true,
      lastIp: true,
      lastCity: true,
      lastCountry: true,
      lastLat: true,
      lastLng: true,
      lastActiveAt: true,
    },
    orderBy: { lastActiveAt: "desc" },
    take: 300,
  });

  let anyApproximate = false;

  const active = await Promise.all(
    users.map(async (user): Promise<ActivePresenceRow> => {
      let lat = user.lastLat;
      let lng = user.lastLng;
      let city = user.lastCity;
      let country = user.lastCountry;

      // Self-heal rows written before geo resolution completed (or before this
      // feature existed): resolve once and persist.
      if ((lat == null || lng == null) && user.lastIp) {
        const geo = await resolveGeo(user.lastIp);
        if (geo) {
          lat = geo.lat;
          lng = geo.lng;
          city = geo.city;
          country = geo.country;
          void prisma.user
            .update({
              where: { id: user.id },
              data: {
                lastCity: geo.city,
                lastCountry: geo.country,
                lastLat: geo.lat,
                lastLng: geo.lng,
              },
            })
            .catch(() => {});
        }
      }

      let approximate = false;
      if (lat == null || lng == null) {
        const fallback = pseudoLocation(user.id);
        lat = fallback.lat;
        lng = fallback.lng;
        approximate = true;
        anyApproximate = true;
      }

      return {
        id: user.id,
        fullName: user.fullName,
        role: user.role,
        ip: user.lastIp ?? null,
        city,
        country,
        lat,
        lng,
        lastActiveAt: (user.lastActiveAt ?? new Date()).toISOString(),
        approximate,
      };
    }),
  );

  return {
    active,
    generatedAt: new Date().toISOString(),
    approximate: anyApproximate,
    windowMinutes: ACTIVE_WINDOW_MS / 60_000,
  };
}

export interface LoginActivityEvent {
  id: string;
  at: string;
  kind: "login" | "logout";
  fullName: string;
  role: string;
  mascot: string | null;
}

export interface LoginActivityResult {
  events: LoginActivityEvent[];
  /** Sign-ins in the window. */
  total: number;
  /** Sign-outs in the window. */
  signOuts: number;
  windowHours: number;
}

/**
 * Every sign-in and sign-out in the last `hours` hours (default 24), oldest
 * first, for the admin overview's activity chart. The chart plots the running
 * totals per event timestamp — no hourly buckets.
 */
export async function listLoginActivity(hours = 24): Promise<LoginActivityResult> {
  const windowHours = Math.min(168, Math.max(1, Math.floor(hours)));
  const HOUR_MS = 60 * 60 * 1000;
  const start = new Date(Date.now() - windowHours * HOUR_MS);

  const events = await prisma.loginEvent.findMany({
    where: { occurredAt: { gte: start } },
    select: {
      userId: true,
      occurredAt: true,
      kind: true,
      user: {
        select: {
          fullName: true,
          role: true,
          studentProfile: { select: { mascot: true } },
          staffProfile: { select: { mascot: true } },
        },
      },
    },
    orderBy: { occurredAt: "asc" },
    take: 20_000,
  });

  let total = 0;
  let signOuts = 0;
  for (const event of events) {
    if (event.kind === "logout") signOuts += 1;
    else total += 1;
  }

  return {
    events: events.map((event) => ({
      id: event.userId,
      at: event.occurredAt.toISOString(),
      kind: event.kind === "logout" ? "logout" : "login",
      fullName: event.user.fullName,
      role: event.user.role,
      mascot: event.user.staffProfile?.mascot ?? event.user.studentProfile?.mascot ?? null,
    })),
    total,
    signOuts,
    windowHours,
  };
}
