"use client";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatDateTime,
  sessionTypeLabel,
} from "../../referrals/components/guidance-referrals-table";
import type { AtRiskStudentItem } from "@/services/guidance/interventions.types";
import { liveSessionLabel, liveSessionState } from "./counseling-plan";
import styles from "./guidance-interventions.module.css";
export function SessionListDialog({
  row,
  followUp,
  sessionsOpen,
  historyOpen,
  onSessionsOpenChange,
  onHistoryOpenChange,
  now,
}: {
  row: AtRiskStudentItem;
  followUp: AtRiskStudentItem["intervention"];
  sessionsOpen: boolean;
  historyOpen: boolean;
  onSessionsOpenChange: (open: boolean) => void;
  onHistoryOpenChange: (open: boolean) => void;
  now: number;
}) {
  return (
    <>
      <Dialog
        open={sessionsOpen}
        onOpenChange={(open) => {
          if (!open) onSessionsOpenChange(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Booked sessions</DialogTitle>
            <DialogDescription>
              Counseling sessions for {row.student}.
            </DialogDescription>
          </DialogHeader>
          {!followUp || followUp.sessions.length === 0 ? (
            <p className={styles.empty}>No sessions booked yet.</p>
          ) : (
            <ul className={styles.sessList}>
              {followUp.sessions.map((s) => (
                <li key={s.id} className={styles.sessItem}>
                  <div className={styles.sessMain}>
                    <p className={styles.sessTitle}>{sessionTypeLabel(s.sessionType)}</p>
                    <p className={styles.sessSub}>
                      {formatDateTime(s.scheduledAt)}
                      {s.venue ? ` · ${s.venue}` : ""}
                    </p>
                  </div>
                  <Badge
                    variant={
                      s.status === "completed"
                        ? "success"
                        : s.status === "cancelled"
                          ? "secondary"
                          : "default"
                    }
                  >
                    {liveSessionLabel(liveSessionState(s.status, s.scheduledAt, now))}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={historyOpen}
        onOpenChange={(open) => {
          if (!open) onHistoryOpenChange(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Session history</DialogTitle>
            <DialogDescription>
              Every session on {row.student}&apos;s closed follow-up.
            </DialogDescription>
          </DialogHeader>
          {!followUp || followUp.sessions.length === 0 ? (
            <p className={styles.empty}>No sessions on record.</p>
          ) : (
            <ul className={styles.sessList}>
              {followUp.sessions.map((s) => (
                <li key={s.id} className={styles.sessItem}>
                  <div className={styles.sessMain}>
                    <p className={styles.sessTitle}>{sessionTypeLabel(s.sessionType)}</p>
                    <p className={styles.sessSub}>
                      {formatDateTime(s.scheduledAt)}
                      {s.venue ? ` · ${s.venue}` : ""}
                    </p>
                    {s.status === "completed" && s.sessionNotes ? (
                      <p className={styles.sessSub}>{s.sessionNotes}</p>
                    ) : null}
                    {s.status === "completed" && s.outcome ? (
                      <p className={styles.sessSub}>Outcome: {s.outcome}</p>
                    ) : null}
                    {s.status === "cancelled" && s.cancelReason ? (
                      <p className={styles.sessSub}>{s.cancelReason}</p>
                    ) : null}
                  </div>
                  <Badge
                    variant={
                      s.status === "completed"
                        ? "success"
                        : s.status === "cancelled"
                          ? "secondary"
                          : "default"
                    }
                  >
                    {liveSessionLabel(liveSessionState(s.status, s.scheduledAt, now))}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
