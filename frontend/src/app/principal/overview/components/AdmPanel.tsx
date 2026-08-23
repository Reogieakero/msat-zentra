import * as React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
            <Skeleton className={styles.summaryValueSkeleton} />
            <span className={styles.admSummaryLabel}>Pending Cases</span>
          </div>
          <div className={styles.admSummaryItem}>
            <Skeleton className={styles.summaryValueSkeleton} />
            <span className={styles.admSummaryLabel}>Signed This Term</span>
          </div>
        </div>
        <div className={styles.admList}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={styles.admDoc}>
              <div className={styles.admDocMain}>
                <div className={styles.admDocTop}>
                  <Skeleton className={styles.docIdSkeleton} />
                  <Skeleton className={styles.docStatusSkeleton} />
                </div>
                <div className={styles.admDocMeta}>
                  <Skeleton className={styles.docMetaSkeleton} />
                  <Skeleton className={styles.docMetaSkeleton} />
                </div>
                <Skeleton className={styles.docEligibilitySkeleton} />
              </div>
              <Skeleton className={styles.docSignSkeleton} />
            </div>
          ))}
        </div>
        <Skeleton className={styles.tabLinkSkeleton} />
      </div>
    );
  }

  const pendingDocs = docs.filter((d) => d.status === "pending_signature");
  const signed = docs.length - pendingDocs.length;
  const latestPending = pendingDocs.slice(-3).reverse();

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
        {latestPending.map((d) => (
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
