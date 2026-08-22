"use client";

import { useState } from "react";
import { getAccessToken } from "@/lib/api/client";

export type Session = {
  sub: string;
  role: string;
  gradeBand: "7-10" | "11-12" | null;
} | null;

function decode(token: string): Session {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      sub: payload.sub,
      role: payload.role,
      gradeBand: payload.gradeBand ?? null,
    };
  } catch {
    return null;
  }
}

// Lightweight client-side session reader. Real enforcement stays server-side in
// the backend; this is a scaffold stub for role-aware shells only.
export function useSession(): Session {
  const [session] = useState<Session>(() => {
    const token = getAccessToken();
    return token ? decode(token) : null;
  });

  return session;
}
