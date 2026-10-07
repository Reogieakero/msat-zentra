"use client";

import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import {
  coordinatorNotificationTarget,
  coordinatorNotificationTitle,
} from "@/lib/notifications/label";

/* ADM coordinator inbox bell — the shared bell with coordinator-scoped
   targets (devices ledger, referrals queue, learner profiles). Shows the
   latest 5 with a "View all" overlay, same as the teacher desk. Bell and
   sileo share one title mapper so both name each event identically. */
export function CoordinatorNotificationsBell() {
  return (
    <NotificationsBell
      queryKey={["coordinator-notifications"]}
      resolveTarget={coordinatorNotificationTarget}
      titleFor={coordinatorNotificationTitle}
    />
  );
}
