"use client";

import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import {
  guidanceNotificationTarget,
  guidanceNotificationTitle,
} from "@/lib/notifications/label";

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
