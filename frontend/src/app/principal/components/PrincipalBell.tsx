"use client";

import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { principalNotificationTarget } from "@/lib/notifications/label";

/* Principal inbox bell — the shared bell with principal-scoped targets
   (schedule submissions deep-link to the section's review page). */
export function PrincipalBell() {
  return (
    <NotificationsBell
      queryKey={["principal-notifications"]}
      refreshKeys={[["principal-notifications"], ["principal-schedule-sections"]]}
      resolveTarget={principalNotificationTarget}
    />
  );
}
