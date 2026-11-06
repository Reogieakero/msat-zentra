"use client";

import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import {
  coordinatorNotificationTarget,
  coordinatorNotificationTitle,
} from "@/lib/notifications/label";

export function CoordinatorNotificationsBell() {
  return (
    <NotificationsBell
      queryKey={["coordinator-notifications"]}
      resolveTarget={coordinatorNotificationTarget}
      titleFor={coordinatorNotificationTitle}
    />
  );
}
