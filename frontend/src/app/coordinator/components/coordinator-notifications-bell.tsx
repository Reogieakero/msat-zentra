"use client";

import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { coordinatorNotificationTarget } from "@/lib/notifications/label";

/* ADM coordinator inbox bell — the shared bell with coordinator-scoped
   targets (devices ledger, referrals queue, learner profiles). Shows the
   latest 5 with a "View all" overlay, same as the teacher desk. */
export function CoordinatorNotificationsBell() {
  return (
    <NotificationsBell
      queryKey={["coordinator-notifications"]}
      refreshKeys={[["coordinator-notifications"], ["coordinator-dashboard"]]}
      resolveTarget={coordinatorNotificationTarget}
    />
  );
}
