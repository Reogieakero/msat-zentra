"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  formatBellDate,
  prettifyNotificationType,
  type BellNotificationTarget,
} from "@/lib/notifications/label";
import styles from "./notifications-bell.module.css";

export interface BellNotice {
  id: string;
  type: string;
  sourceTable: string | null;
  sourceId: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// The dropdown never scrolls: only the latest few show, anything beyond
// opens the "View all" overlay instead.
const VISIBLE_COUNT = 5;

function bellApiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

async function fetchBellNotices(signal?: AbortSignal): Promise<BellNotice[]> {
  const { data } = await apiClient.get<BellNotice[]>("/api/notifications/", {
    signal,
  });
  return Array.isArray(data) ? data : [];
}

interface NotificationsBellProps {
  /** React Query key backing the inbox (e.g. ["teacher-notifications"]). */
  queryKey: string[];
  /** Every key invalidated after a read (defaults to [queryKey]). */
  refreshKeys?: string[][];
  /** Role-scoped deep link for an item (schedule verdict → section page). */
  resolveTarget: (n: BellNotice) => BellNotificationTarget;
}

/* Shared notification bell — one icon, badge, dropdown, and view-all
   overlay used by the teacher and principal desks. Missed sileo toasts stay
   here with an unread badge; realtime invalidation keeps the count live
   without manual refresh. */
export function NotificationsBell({ queryKey, refreshKeys, resolveTarget }: NotificationsBellProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [viewAllOpen, setViewAllOpen] = React.useState(false);
  const targets = refreshKeys ?? [queryKey];

  const notificationsQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchBellNotices(signal),
    staleTime: 30_000,
  });

  const notifications = notificationsQuery.data ?? [];
  const unread = notifications.filter((n) => !n.isRead).length;

  const refresh = () => {
    for (const key of targets) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };

  const readOneMutation = useMutation({
    mutationFn: async ({ id, href }: { id: string; href: string | null }) => {
      await apiClient.post(`/api/notifications/read/${id}`, {});
      return { href };
    },
    onSuccess: ({ href }) => {
      refresh();
      if (href) {
        setViewAllOpen(false);
        router.push(href);
      } else
        toast.success({
          title: "Notification updated",
          description: "The notification was marked as read.",
        });
    },
    onError: (err) =>
      toast.error({
        title: "Could not mark as read",
        description: bellApiErrorMessage(err, "Could not mark this notification as read."),
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
        description: bellApiErrorMessage(err, "Could not mark notifications as read."),
      }),
  });

  const readingId = readOneMutation.isPending
    ? ((readOneMutation.variables as { id: string } | undefined)?.id ?? null)
    : null;

  const openNotice = (n: BellNotice) => {
    if (readingId === n.id) return;
    const target = resolveTarget(n);
    if (!n.isRead) readOneMutation.mutate({ id: n.id, href: target?.href ?? null });
    else if (target) {
      setViewAllOpen(false);
      router.push(target.href);
    }
  };

  const renderBody = (n: BellNotice) => (
    <>
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
    </>
  );

  return (
    <>
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
            notifications.slice(0, VISIBLE_COUNT).map((n) => {
              const target = resolveTarget(n);
              return (
                <DropdownMenuItem
                  key={n.id}
                  disabled={readingId === n.id || (n.isRead && !target)}
                  onSelect={(e) => {
                    e.preventDefault();
                    openNotice(n);
                  }}
                  className={styles.bellItem}
                >
                  {renderBody(n)}
                </DropdownMenuItem>
              );
            })
          )}
          {notifications.length > VISIBLE_COUNT ? (
            <>
              <DropdownMenuSeparator />
              <button
                type="button"
                className={styles.viewAll}
                onClick={() => setViewAllOpen(true)}
              >
                View all ({notifications.length})
              </button>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {viewAllOpen ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setViewAllOpen(false);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Notifications</DialogTitle>
              <DialogDescription>
                {unread === 0
                  ? "You're all caught up."
                  : `${unread} unread notification${unread === 1 ? "" : "s"}.`}
              </DialogDescription>
            </DialogHeader>
            <div className={styles.modalList} aria-label="All notifications">
              {notifications.map((n) => {
                const target = resolveTarget(n);
                return (
                  <button
                    key={n.id}
                    type="button"
                    disabled={readingId === n.id || (n.isRead && !target)}
                    onClick={() => openNotice(n)}
                    className={styles.modalItem}
                  >
                    {renderBody(n)}
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
