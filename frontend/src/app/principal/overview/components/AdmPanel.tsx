import * as React from "react";
import { Button } from "@/components/ui/button";
import { TabLink } from "./TabLink";
import { type AdmDocument } from "./data";
import { apiClient } from "@/lib/api/client";
import styles from "./adm-panel.module.css";

const EMPTY: AdmDocument[] = [];

export function AdmPanel({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const [docs, setDocs] = React.useState<AdmDocument[]>(EMPTY);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .get<AdmDocument[]>("/api/adm/referrals")
      .then((res) => {
        if (!cancelled) setDocs(res.data);
      })
      .catch((err: unknown) => {
        console.error("[/api/adm/referrals] fetch failed:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className={styles.admPanel}>
        <div className={styles.admSummary}>
          <div className={styles.admSummaryItem}>
            <span className={styles.admSummaryValue}>—</span>
            <span className={styles.admSummaryLabel}>Pending Cases</span>
          </div>
          <div className={styles.admSummaryItem}>
            <span className={styles.admSummaryValue}>—</span>
            <span className={styles.admSummaryLabel}>Signed This Term</span>
          </div>
        </div>
        <div className={styles.admList}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={styles.admDoc}>
              <div className={styles.admDocMain}>
                <div className={styles.admDocTop}>
                  <span className={styles.admDocId}>ADM-0000</span>
                  <span className={styles.admStatus}>Pending Approval</span>
                </div>
                <div className={styles.admDocMeta}>
                  <span className={styles.mono}>000000000000</span>
                  <span>Loading…</span>
                </div>
              </div>
              <Button size="sm" className={styles.admSign} disabled>
                Approve
              </Button>
            </div>
          ))}
        </div>
        <TabLink href={href} label={label} />
      </div>
    );
  }

  const pendingDocs = docs.filter((d) => d.status === "pending_signature");
  const signed = docs.length - pendingDocs.length;

  return (
    <div className={styles.admPanel}>
      <div className={styles.admSummary}>
        <div className={styles.admSummaryItem}>
          <span className={styles.admSummaryValue}>{pendingDocs.length}</span>
          <span className={styles.admSummaryLabel}>Pending Cases</span>
        </div>
        <div className={styles.admSummaryItem}>
          <span className={styles.admSummaryValue}>{signed}</span>
          <span className={styles.admSummaryLabel}>Signed This Term</span>
        </div>
      </div>

      <div className={styles.admList}>
        {pendingDocs.map((d) => (
          <div key={d.id} className={styles.admDoc}>
            <div className={styles.admDocMain}>
              <div className={styles.admDocTop}>
                <span className={styles.admDocId}>{d.id}</span>
                <span className={styles.admStatus}>Pending Approval</span>
              </div>
              <div className={styles.admDocMeta}>
                <span className={styles.mono}>{d.lrn}</span>
                <span>{d.student}</span>
                <span>{d.grade}</span>
                <span className={styles.admMuted}>
                  Prepared by {d.preparedBy}
                </span>
              </div>
              <span className={styles.admEligibility}>
                Eligibility: {d.eligibility}
              </span>
            </div>
            <Button size="sm" className={styles.admSign}>
              Approve
            </Button>
          </div>
        ))}
      </div>

      <TabLink href={href} label={label} />
    </div>
  );
}
