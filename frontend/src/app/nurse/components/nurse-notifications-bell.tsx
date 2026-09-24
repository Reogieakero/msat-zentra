"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { apiErrorMessage } from "../overview/components/nurse-overview-data";
import {
  formatBellDate,
  nurseNotificationTarget,
  prettifyNotificationType,
} from "@/lib/notifications/label";
import styles from "../nurse.module.css";

interface NurseNotificationItem {
  id: string;
  userId: string;
  type: string;
  sourceTable: string | null;
  sourceId: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}

async function fetchNurseNotifications(signal?: AbortSignal): Promise<NurseNotificationItem[]> {
  const { data } = await apiClient.get<NurseNotificationItem[]>("/api/notifications/", {
    signal,
  });
  return Array.isArray(data) ? data : [];
}

/* Persistent notification bell — the sole nurse inbox (bell-only decision).
   The legacy page-level NurseNotifications panel was removed; missed sileo
   toasts stay here with an unread badge. Realtime invalidation keeps the
   count live without manual refresh. */
export function NurseNotificationsBell() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({
    queryKey: ["nurse-notifications"],
    queryFn: ({ signal }) => fetchNurseNotifications(signal),
    staleTime: 30_000,
  });

  const notifications = notificationsQuery.data ?? [];
  const unread = notifications.filter((n) => !n.isRead).length;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["nurse-notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["nurse-alerts"] });
    void queryClient.invalidateQueries({ queryKey: ["nurse-overview"] });
  };

  const readOneMutation = useMutation({
    mutationFn: async ({ id, href }: { id: string; href: string | null }) => {
      const { data } = await apiClient.post(`/api/notifications/read/${id}`, {});
      return { data, href };
    },
    onSuccess: ({ href }) => {
      refresh();
      if (href) router.push(href);
      else
        toast.success({
          title: "Notification updated",
          description: "The notification was marked as read.",
        });
    },
    onError: (err) =>
      toast.error({
        title: "Could not mark as read",
        description: apiErrorMessage(err, "Could not mark this notification as read."),
      }),
  });

  const readAllMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post("/api/notifications/read-all", {});
      return data;
    },
    onSuccess: () => {
      refresh();
      toast.success({
        title: "All caught up",
        description: "Every notification is marked as read.",
      });
    },
    onError: (err) =>
      toast.error({
        title: "Could not mark all as read",
        description: apiErrorMessage(err, "Could not mark notifications as read."),
      }),
  });

  const readingId = readOneMutation.isPending
    ? ((readOneMutation.variables as { id: string } | undefined)?.id ?? null)
    : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={styles.bellButton}
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Bell className={styles.bellIcon} aria-hidden="true" />
          {unread > 0 ? (
            <span className={styles.bellBadge} aria-hidden="true" aria-live="polite">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={styles.bellMenu}>
        <DropdownMenuLabel className={styles.bellHead}>
          <span>
            {unread === 0
              ? "Notifications"
              : `${unread} unread notification${unread === 1 ? "" : "s"}`}
          </span>
          {unread > 0 ? (
            <Button
              variant="ghost"
              size="xs"
              disabled={readAllMutation.isPending}
              onClick={() => readAllMutation.mutate()}
            >
              {readAllMutation.isPending ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : null}
              {readAllMutation.isPending ? "Marking…" : "Mark all read"}
            </Button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notificationsQuery.isPending ? (
          <DropdownMenuItem disabled>Loading notifications…</DropdownMenuItem>
        ) : notificationsQuery.isError ? (
          <DropdownMenuItem
            disabled={notificationsQuery.isRefetching}
            onSelect={(e) => {
              e.preventDefault();
              void notificationsQuery.refetch();
            }}
          >
            Could not load notifications — select to retry.
          </DropdownMenuItem>
        ) : notifications.length === 0 ? (
          <DropdownMenuItem disabled>No notifications yet.</DropdownMenuItem>
        ) : (
          notifications.slice(0, 10).map((n) => {
            const target = nurseNotificationTarget(n);
            return (
              <DropdownMenuItem
                key={n.id}
                disabled={readingId === n.id || (n.isRead && !target)}
                onSelect={(e) => {
                  e.preventDefault();
                  if (readingId === n.id) return;
                  if (!n.isRead) readOneMutation.mutate({ id: n.id, href: target?.href ?? null });
                  else if (target) router.push(target.href);
                }}
                className={styles.bellItem}
              >
                <span
                  className={`${styles.bellDot} ${!n.isRead ? styles.bellDotUnread : ""}`}
                  aria-hidden="true"
                />
                <span className={styles.bellMain}>
                  <span className={styles.bellTitle}>{prettifyNotificationType(n.type)}</span>
                  <span className={styles.bellMsg}>{n.message}</span>
                  <span className={styles.bellDate}>
                    {formatBellDate(n.createdAt)}
                    {readingId === n.id ? " · Marking…" : ""}
                  </span>
                </span>
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
