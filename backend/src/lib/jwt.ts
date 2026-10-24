import jwt from "jsonwebtoken";
import { getEnv } from "../config/env.js";

export interface JwtAccessPayload {
  sub: string;
  role: string;
  gradeBand?: "7-10" | "11-12" | null;
  type: "access";
}

export interface JwtRefreshPayload {
  sub: string;
  type: "refresh";
}

export function signAccess(payload: Omit<JwtAccessPayload, "type">): string {
  const env = getEnv();
  return jwt.sign({ ...payload, type: "access" }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
  } as jwt.SignOptions);
}

export function signRefresh(payload: Omit<JwtRefreshPayload, "type">): string {
  const env = getEnv();
  return jwt.sign({ ...payload, type: "refresh" }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL,
  } as jwt.SignOptions);
}

// Supabase Realtime/PostgREST read the JWT `role` claim as the Postgres role and
// require "authenticated"; the app's access token uses `role` for the app role,
// so realtime gets its own short-lived token. Only takes effect once the
// Supabase project's JWT secret is set to match JWT_ACCESS_SECRET.
export const REALTIME_TOKEN_TTL_SECONDS = 15 * 60;

export function signRealtimeToken(userId: string): string {
  const env = getEnv();
  return jwt.sign(
    { sub: userId, role: "authenticated", aud: "authenticated", type: "realtime" },
    env.JWT_ACCESS_SECRET,
    { expiresIn: REALTIME_TOKEN_TTL_SECONDS },
  );
}

export function verifyAccess(token: string): JwtAccessPayload {
  const env = getEnv();
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtAccessPayload;
  if (decoded.type !== "access") throw new Error("Invalid token type");
  return decoded;
}

export function verifyRefresh(token: string): JwtRefreshPayload {
  const env = getEnv();
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtRefreshPayload;
  if (decoded.type !== "refresh") throw new Error("Invalid token type");
  return decoded;
}
