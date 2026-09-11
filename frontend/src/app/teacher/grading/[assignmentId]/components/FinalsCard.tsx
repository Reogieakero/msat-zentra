"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { lockFinalGrade, useRefreshAcademic, type ClassStudent } from "../../components/grading-data";
import styles from "./FinalsCard.module.css";

type Props = {
  students: ClassStudent[];
  onChanged: () => void;
  onShowSolution: (studentId: string) => void;
};

export function FinalsCard({ students, onChanged, onShowSolution }: Props) {
  const refreshAcademic = useRefreshAcademic();
  const [lockingIds, setLockingIds] = React.useState<Record<string, boolean>>({});
  const [error, setError] = React.useState<string | null>(null);

  const handleLock = async (finalId: string) => {
    setLockingIds((prev) => ({ ...prev, [finalId]: true }));
    try {
      await lockFinalGrade(finalId);
      onChanged();
      refreshAcademic();
    } catch {
      setError("Failed to lock final grade.");
    } finally {
      setLockingIds((prev) => ({ ...prev, [finalId]: false }));
    }
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Final grades</h2>
      <p className={styles.cardSub}>
        Recomputed automatically on every saved score. Lock a row to submit it for adviser approval.
      </p>
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
                  <td>{f?.lockStatus ?? "—"}</td>
                  <td>
                    <div className={styles.row}>
                      {f && f.lockStatus === "unlocked" ? (
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={!lockable || !!lockingIds[f.id]}
                          onClick={() => void handleLock(f.id)}
                        >
                          {lockingIds[f.id] ? "Locking…" : "Lock"}
                        </Button>
                      ) : null}
                      <Button size="xs" variant="ghost" onClick={() => onShowSolution(s.id)}>
                        Solution
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
  );
}
