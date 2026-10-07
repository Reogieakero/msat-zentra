"use client";

import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import {
  nurseNotificationTarget,
  nurseNotificationTitle,
} from "@/lib/notifications/label";

/* Nurse inbox bell — the shared bell (latest 5 + "View all" overlay, same
   as the teacher desk) with nurse-scoped titles and targets. Realtime
   invalidation keeps the count live without manual refresh. */
export function NurseNotificationsBell() {
  return (
    <NotificationsBell
      queryKey={["nurse-notifications"]}
      refreshKeys={[
        ["nurse-notifications"],
        ["nurse-alerts"],
        ["nurse-overview"],
        ["nurse-risk"],
        ["nurse-risk-levels"],
        ["nurse-risk-factors"],
      ]}
      resolveTarget={nurseNotificationTarget}
      titleFor={nurseNotificationTitle}
    />
  );
}
