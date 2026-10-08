export const REFRESH_COOKIE_NAME = "zentra.refresh";

export const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

export interface CookieOptions {
  secure: boolean;
  maxAge?: number;
}

function serialize(
  name: string,
  value: string,
  { secure, maxAge }: CookieOptions,
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/api/auth",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function setRefreshCookie(
  res: { setHeader: (name: string, value: string | string[]) => void },
  token: string,
  opts: CookieOptions,
): void {
  res.setHeader(
    "Set-Cookie",
    serialize(REFRESH_COOKIE_NAME, token, {
      ...opts,
      maxAge: REFRESH_COOKIE_MAX_AGE,
    }),
  );
}

export function clearRefreshCookie(
  res: { setHeader: (name: string, value: string | string[]) => void },
  opts: CookieOptions,
): void {
  res.setHeader(
    "Set-Cookie",
    serialize(REFRESH_COOKIE_NAME, "", { ...opts, maxAge: 0 }),
  );
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    if (!name) continue;
    try {
      out[name] = decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      out[name] = part.slice(idx + 1).trim();
    }
  }
  return out;
}

export function getRefreshCookie(req: {
  headers: { cookie?: string };
}): string | null {
  const value = parseCookies(req.headers.cookie)[REFRESH_COOKIE_NAME];
  return value ? value : null;
}

export function isSecureContext(): boolean {
  return process.env.NODE_ENV === "production";
}
