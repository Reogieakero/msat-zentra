"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { apiErrorMessage } from "../../overview/components/nurse-overview-data";
import {
  markAllNurseNotificationsRead,
  markNurseNotificationRead,
  type NurseNotificationItem,
} from "./nurse-alerts-data";
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
  const [acting, setActing] = React.useState(false);

  async function handleRead(id: string) {
    setActing(true);
    try {
      await markNurseNotificationRead(id);
      onChanged();
    } catch (err) {
      toast.error({
        title: "Update failed",
        description: apiErrorMessage(err, "Could not mark this notification as read."),
      });
    } finally {
      setActing(false);
    }
  }

  async function handleReadAll() {
    setActing(true);
    try {
      await markAllNurseNotificationsRead();
      toast.success({ title: "All caught up", description: "Every notification is marked as read." });
      onChanged();
    } catch (err) {
      toast.error({
        title: "Update failed",
        description: apiErrorMessage(err, "Could not mark notifications as read."),
      });
    } finally {
      setActing(false);
    }
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
          <Button variant="outline" size="sm" disabled={acting} onClick={() => void handleReadAll()}>
            Mark all read
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
                  disabled={acting}
                  onClick={() => void handleRead(n.id)}
                >
                  Mark read
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
