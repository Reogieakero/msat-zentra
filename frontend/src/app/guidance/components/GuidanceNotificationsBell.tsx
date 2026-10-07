"use client";

import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import {
  guidanceNotificationTarget,
  guidanceNotificationTitle,
} from "@/lib/notifications/label";

/* Guidance inbox bell — the shared bell with guidance-scoped targets
   (referred cases deep-link to the referrals queue). Realtime sync keeps
   the badge count live without manual refresh. */
export function GuidanceNotificationsBell() {
  return (
    <NotificationsBell
      queryKey={["guidance-notifications"]}
      refreshKeys={[
        ["guidance-notifications"],
        ["guidance-referrals"],
        ["guidance-interventions"],
        ["guidance-overview"],
        ["guidance-alerts"],
        ["guidance-adm"],
        ["guidance-anecdotal"],
        ["guidance-risk"],
      ]}
      resolveTarget={guidanceNotificationTarget}
      titleFor={guidanceNotificationTitle}
    />
  );
}
