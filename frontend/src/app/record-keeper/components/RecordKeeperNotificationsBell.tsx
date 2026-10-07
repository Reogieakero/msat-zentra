"use client";

import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import {
  recordKeeperNotificationTarget,
  recordKeeperNotificationTitle,
} from "@/lib/notifications/label";

/* Record-keeper inbox bell — the shared bell with record-keeper-scoped
   targets (pending sign-ups deep-link to the accounts queue, finals-ready
   to the finals list, access requests to the access queue, SF10 rows to
   SF10). */
export function RecordKeeperNotificationsBell() {
  return (
    <NotificationsBell
      queryKey={["record-keeper-notifications"]}
      refreshKeys={[
        ["record-keeper-notifications"],
        ["record-keeper-overview"],
        ["record-keeper-final-grades"],
        ["record-keeper-pending-students"],
        ["record-keeper-access"],
      ]}
      resolveTarget={recordKeeperNotificationTarget}
      titleFor={recordKeeperNotificationTitle}
    />
  );
}
