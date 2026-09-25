"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lockFinalGrade, useRefreshAcademic, type ClassStudent } from "../../components/grading-data";
import { sileo } from "@/components/ui/sonner";
import styles from "./FinalsCard.module.css";

type Props = {
  assignmentId: string;
  students: ClassStudent[];
  onChanged: () => void;
};

function lockLabel(lockStatus: string | null): string {
  if (lockStatus === "adviser_approved") return "Adviser approved";
  if (lockStatus === "locked") return "Locked";
  if (lockStatus === "unlocked") return "Unlocked";
  return "—";
}

export function FinalsCard({ assignmentId, students, onChanged }: Props) {
  const refreshAcademic = useRefreshAcademic();
  const [lockingIds, setLockingIds] = React.useState<Record<string, boolean>>({});
  const [error, setError] = React.useState<string | null>(null);

  const handleLock = async (finalId: string, studentName: string) => {
    if (lockingIds[finalId]) return;
    setLockingIds((prev) => ({ ...prev, [finalId]: true }));
    setError(null);
    try {
      await lockFinalGrade(finalId);
      onChanged();
      refreshAcademic();
      sileo.success({ title: "Final grade locked", description: `${studentName}'s grade was submitted for adviser approval.` });
    } catch {
      setError("Failed to lock final grade.");
      sileo.error({ title: "Could not lock final grade", description: "Try again." });
    } finally {
      setLockingIds((prev) => ({ ...prev, [finalId]: false }));
    }
  };

  const lockedCount = students.filter(
    (s) => s.final != null && s.final.lockStatus !== "unlocked"
  ).length;

  return (
    <div className={styles.card}>
      <div className={styles.banner}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>Final grades</h2>
          <p className={styles.cardSub}>
            Recomputed automatically on every saved score. Lock a row to submit it for adviser approval.
          </p>
        </div>
        <div className={styles.bannerStats}>
          <div className={styles.bannerStat}>
            <span className={styles.bannerValue}>{students.length}</span>
            <span className={styles.bannerLabel}>Students</span>
          </div>
          <div className={styles.bannerStat}>
            <span className={styles.bannerValue}>{lockedCount}</span>
            <span className={styles.bannerLabel}>Locked</span>
          </div>
        </div>
      </div>
      <div className={styles.body}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.stickyCol}>Student</th>
              <th>Computed</th>
              <th>Transmuted</th>
              <th>Remarks</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const f = s.final;
              const lockable = !!f && f.lockStatus === "unlocked" && f.computedAverage != null;
              return (
                <tr key={s.id}>
                  <th className={styles.stickyCol} scope="row">
                    {s.name}
                  </th>
                  <td>{f?.computedAverage != null ? f.computedAverage.toFixed(2) : "—"}</td>
                  <td>{f?.transmutedGrade != null ? f.transmutedGrade.toFixed(0) : "—"}</td>
                  <td>{f?.remarks ?? "—"}</td>
                  <td>{lockLabel(f?.lockStatus ?? null)}</td>
                  <td>
                    <div className={styles.row}>
                      {f && f.lockStatus === "unlocked" ? (
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={!lockable || !!lockingIds[f.id]}
                          aria-busy={!!lockingIds[f.id] || undefined}
                          onClick={() => void handleLock(f.id, s.name)}
                        >
                          {lockingIds[f.id] ? (
                            <>
                              <Loader2 className="animate-spin" aria-hidden />
                              Locking…
                            </>
                          ) : (
                            "Lock"
                          )}
                        </Button>
                      ) : null}
                      <Button size="xs" variant="ghost" asChild>
                        <a
                          href={`/record/${assignmentId}/solution/${encodeURIComponent(s.id)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Solution
                        </a>
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error ? <p className={styles.errorText}>{error}</p> : null}
      </div>
    </div>
  );
}
