"use client";

import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import {
  nurseNotificationTarget,
  nurseNotificationTitle,
} from "@/lib/notifications/label";

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
