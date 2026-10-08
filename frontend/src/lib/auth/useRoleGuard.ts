"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "./useSession";

export function useRoleGuard(allowedRoles: readonly string[]) {
  const session = useSession();
  const router = useRouter();

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

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, session, router, allowedRoles.join(",")]);

  return { session, allowed };
}
