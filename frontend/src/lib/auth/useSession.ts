"use client";

import { useState } from "react";
import { getAccessToken } from "@/lib/api/client";
import { decodeTokenIdentity, type TokenIdentity } from "@/lib/auth/roles";

export type Session = TokenIdentity | null;

export function useSession(): Session {
  const [session] = useState<Session>(() => decodeTokenIdentity(getAccessToken()));
  return session;
}
