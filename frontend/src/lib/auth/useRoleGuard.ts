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
  // Gate on mount so the server HTML and the first client paint are
  // identical. Without this, the server (no localStorage → session null →
  // fallback) and the hydrated client (real token → full shell) render
  // different trees → React hydration mismatch. Same mounted pattern as
  // ThemeProvider/FontProvider.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setMounted(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const allowed =
    mounted && session !== null && allowedRoles.includes(session.role);

  React.useEffect(() => {
    if (!mounted) return;
    if (session === null) {
      router.replace("/login");
    } else if (!allowedRoles.includes(session.role)) {
      router.replace("/errors/403");
    }
    // allowedRoles is a static literal per caller; stringify for stability.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, session, router, allowedRoles.join(",")]);

  return { session, allowed };
}
