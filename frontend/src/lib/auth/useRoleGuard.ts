"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "./useSession";

/**
 * Lightweight client-side role guard for role shells.
 * Backend remains the authority (requireAuth/requireRole); this only
 * prevents the wrong-role flash + blocks sensitive queries from rendering
 * before the redirect lands.
 */
export function useRoleGuard(allowedRoles: readonly string[]) {
  const session = useSession();
  const router = useRouter();

  const allowed =
    session !== null && allowedRoles.includes(session.role);

  React.useEffect(() => {
    if (session === null) {
      router.replace("/login");
    } else if (!allowedRoles.includes(session.role)) {
      router.replace("/errors/403");
    }
    // allowedRoles is a static literal per caller; stringify for stability.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, router, allowedRoles.join(",")]);

  return { session, allowed };
}
