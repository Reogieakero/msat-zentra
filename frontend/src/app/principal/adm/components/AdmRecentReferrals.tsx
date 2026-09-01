"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Check, ArrowLeftRight } from "lucide-react";
import { fetchAdmDashboard, type AdmLatestReferred } from "../api";
import { ADM_PIPELINE } from "../adm";
import styles from "./AdmRecentReferrals.module.css";

const STAGE_COLORS: Record<string, string> = {
  anecdotal: "#a8a29e",
  consultation: "#f59e0b",
  meeting_parents: "#3b82f6",
  home_visitation: "#8b5cf6",
  certification: "#0ea5e9",
  principal_approval: "#166534",
  enrollment_monitoring: "#10b981",
  completion: "#64748b",
};

function stageLabel(stage: string): string {
  return ADM_PIPELINE.find((s) => s.stage === stage)?.label ?? stage;
}

export function AdmRecentReferrals() {
  const { data, isPending } = useQuery({
    queryKey: ["adm-dashboard"],
    queryFn: ({ signal }) => fetchAdmDashboard(signal),
  });

  const referrals: AdmLatestReferred[] = React.useMemo(
    () => data?.latestReferred ?? [],
    [data]
  );

  const handleSign = (id: string) => {
    apiClient.post(`/api/adm/${id}/principal-approve`).then(() => {
      // Refresh will happen via invalidation or manual reload
    });
  };

  const handleReturn = (id: string) => {
    apiClient.post(`/api/adm/${id}/principal-return`).then(() => {
      // Refresh will happen via invalidation or manual reload
    });
  };

  const canSign = (row: AdmLatestReferred) =>
    row.stage === "principal_approval" &&
    !row.approvedBy &&
    row.eligibilityStatus === "eligible";

  const canReturn = (row: AdmLatestReferred) => !!row.approvedBy;

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Recent Referrals</h2>

      {isPending ? (
        <div className={styles.skeleton}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skeletonRow} />
          ))}
        </div>
      ) : referrals.length === 0 ? (
        <p className={styles.empty}>No recent referrals found.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Student</th>
                <th>Grade</th>
                <th>Stage</th>
                <th>Eligibility</th>
                <th>Prepared By</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((row) => (
                <tr key={row.id} className={styles.row}>
                  <td>
                    <div className={styles.studentCell}>
                      <span className={styles.studentName}>{row.student}</span>
                      <span className={styles.studentLrn}>{row.lrn}</span>
                    </div>
                  </td>
                  <td className={styles.grade}>{row.grade}</td>
                  <td>
                    <span
                      className={styles.stageChip}
                      style={{
                        backgroundColor: `${STAGE_COLORS[row.stage]}15`,
                        color: STAGE_COLORS[row.stage],
                        borderColor: `${STAGE_COLORS[row.stage]}40`,
                      }}
                    >
                      {stageLabel(row.stage)}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`${styles.eligibility} ${
                        row.eligibilityStatus === "eligible"
                          ? styles.eligible
                          : row.eligibilityStatus === "ineligible"
                          ? styles.ineligible
                          : styles.pending
                      }`}
                    >
                      {row.eligibilityStatus === "eligible"
                        ? "Eligible"
                        : row.eligibilityStatus === "ineligible"
                        ? "Ineligible"
                        : "Pending"}
                    </span>
                  </td>
                  <td className={styles.preparedBy}>{row.preparedBy}</td>
                  <td>
                    {canSign(row) ? (
                      <button
                        type="button"
                        className={styles.signBtn}
                        onClick={() => handleSign(row.id)}
                      >
                        <Check aria-hidden />
                        Sign
                      </button>
                    ) : canReturn(row) ? (
                      <button
                        type="button"
                        className={styles.returnBtn}
                        onClick={() => handleReturn(row.id)}
                      >
                        <ArrowLeftRight aria-hidden />
                        Return
                      </button>
                    ) : (
                      <span className={styles.noAction}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
