"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  markAllNurseNotificationsRead,
  markNurseNotificationRead,
  type NurseNotificationItem,
} from "./nurse-alerts-data";
import { useNurseMutation } from "../../overview/components/use-nurse-mutation";
import { Loader2 } from "lucide-react";
import styles from "./nurse-alerts.module.css";

export function NurseNotifications({
  notifications,
  unread,
  onChanged,
}: {
  notifications: NurseNotificationItem[];
  unread: number;
  onChanged: () => void;
}) {
  const readOneMutation = useNurseMutation({
    mutationFn: (id: string) => markNurseNotificationRead(id),
    successTitle: "Notification updated",
    successDescription: () => "The notification was marked as read.",
    errorFallback: "Could not mark this notification as read.",
    onSuccessExtra: () => onChanged(),
  });
  const readAllMutation = useNurseMutation({
    mutationFn: () => markAllNurseNotificationsRead(),
    successTitle: "All caught up",
    successDescription: () => "Every notification is marked as read.",
    errorFallback: "Could not mark notifications as read.",
    onSuccessExtra: () => onChanged(),
  });
  const readingId = readOneMutation.isPending
    ? ((readOneMutation.variables as string | undefined) ?? null)
    : null;
  const readingAll = readAllMutation.isPending;

  function handleRead(id: string) {
    readOneMutation.mutate(id);
  }

  function handleReadAll() {
    readAllMutation.mutate();
  }

  return (
    <Card className={styles.panel}>
      <div className={styles.panelHead}>
        <div className={styles.panelHeadText}>
          <h2 className={styles.panelTitle}>Your notifications</h2>
          <p className={styles.panelDesc}>
            {unread === 0
              ? "System notices sent to your account."
              : `${unread} unread notice${unread === 1 ? "" : "s"} for your account.`}
          </p>
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" disabled={readingAll} onClick={() => handleReadAll()}>
            {readingAll ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {readingAll ? "Marking…" : "Mark all read"}
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className={styles.empty}>No notifications yet.</p>
      ) : (
        <ul className={styles.notifList}>
          {notifications.slice(0, 10).map((n) => (
            <li key={n.id} className={styles.notifItem}>
              <span
                className={`${styles.notifDot} ${!n.isRead ? styles.notifDotUnread : ""}`}
                aria-hidden
              />
              <div className={styles.notifMain}>
                <p className={styles.notifLabel}>{n.label}</p>
                <p className={styles.notifMsg}>{n.message}</p>
                <p className={styles.notifDate}>{n.date}</p>
              </div>
              {!n.isRead && (
                <Button
                  variant="link"
                  className={styles.linkBtn}
                  disabled={readingId === n.id || readingAll}
                  onClick={() => handleRead(n.id)}
                >
                  {readingId === n.id ? <Loader2 className="animate-spin" aria-hidden /> : null}
                  {readingId === n.id ? "Marking…" : "Mark read"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
