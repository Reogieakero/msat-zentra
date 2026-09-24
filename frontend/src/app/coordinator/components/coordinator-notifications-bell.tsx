"use client";

import * as React from "react";
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
import { apiErrorMessage } from "./coordinator-data";
import styles from "../coordinator.module.css";

interface CoordinatorNotificationItem {
  id: string;
  userId: string;
  type: string;
  sourceTable: string | null;
  sourceId: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}

async function fetchCoordinatorNotifications(
  signal?: AbortSignal,
): Promise<CoordinatorNotificationItem[]> {
  const { data } = await apiClient.get<CoordinatorNotificationItem[]>(
    "/api/notifications/",
    { signal },
  );
  return Array.isArray(data) ? data : [];
}

function formatBellDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso.slice(0, 10);
  return `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 5)}`;
}

/* Persistent notification bell — the inbox behind the realtime toasts.
   Missed toasts stay here with an unread badge; reading reuses the same
   backend inbox as the other desks. Realtime/poll invalidation keeps the
   count live without manual refresh. */
export function CoordinatorNotificationsBell() {
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({
    queryKey: ["coordinator-notifications"],
    queryFn: ({ signal }) => fetchCoordinatorNotifications(signal),
    staleTime: 30_000,
  });

  const notifications = notificationsQuery.data ?? [];
  const unread = notifications.filter((n) => !n.isRead).length;

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: ["coordinator-notifications"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["coordinator-dashboard"],
    });
  };

  const readOneMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/api/notifications/read/${id}`, {});
      return data;
    },
    onSuccess: () => {
      refresh();
      toast.success({
        title: "Notification updated",
        description: "The notification was marked as read.",
      });
    },
    onError: (err) =>
      toast.error({
        title: "Could not mark as read",
        description: apiErrorMessage(err),
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
        description: apiErrorMessage(err),
      }),
  });

  const readingId = readOneMutation.isPending
    ? ((readOneMutation.variables as string | undefined) ?? null)
    : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={styles.bellButton}
          aria-label={
            unread > 0
              ? `Notifications, ${unread} unread`
              : "Notifications"
          }
        >
          <Bell className={styles.bellIcon} aria-hidden="true" />
          {unread > 0 ? (
            <span className={styles.bellBadge} aria-hidden="true">
              {unread > 9 ? "9+" : unread}
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
          notifications.slice(0, 10).map((n) => (
            <DropdownMenuItem
              key={n.id}
              disabled={n.isRead || readingId === n.id}
              onSelect={(e) => {
                e.preventDefault();
                if (!n.isRead) readOneMutation.mutate(n.id);
              }}
              className={styles.bellItem}
            >
              <span
                className={`${styles.bellDot} ${!n.isRead ? styles.bellDotUnread : ""}`}
                aria-hidden="true"
              />
              <span className={styles.bellMain}>
                <span className={styles.bellMsg}>{n.message}</span>
                <span className={styles.bellDate}>
                  {formatBellDate(n.createdAt)}
                  {readingId === n.id ? " · Marking…" : ""}
                </span>
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
