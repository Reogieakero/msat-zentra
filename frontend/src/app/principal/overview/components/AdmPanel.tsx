import * as React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { type AdmReferralRow } from "../../adm/api";
import { stageLabel, isAwaitingSignature, STAGE_COLORS, type AdmCase, type AdmPipelineStage } from "../../adm/adm";

const STAGE_LEGEND: AdmPipelineStage[] = [
  "meeting_parents",
  "home_visitation",
  "certification",
  "principal_approval",
];
import { apiClient } from "@/lib/api/client";
import styles from "./adm-panel.module.css";

const EMPTY: AdmReferralRow[] = [];

function toCase(r: AdmReferralRow): AdmCase {
  return {
    id: r.id,
    student: r.student,
    lrn: r.lrn,
    grade: r.grade,
    section: "",
    stage: r.stage,
    eligibilityStatus: r.eligibilityStatus,
    meetingAttended: false,
    modulesSubmitted: 0,
    modulesTotal: 0,
    deviceIssued: false,
    preparedBy: r.preparedBy,
    datePrepared: "",
    approvedBy: r.approvedBy,
    approvalDate: r.approvalDate,
    forms: r.forms,
  };
}

export function AdmPanel({ href }: { href: string }) {
  const [docs, setDocs] = React.useState<AdmReferralRow[]>(EMPTY);
  const [loading, setLoading] = React.useState(true);
  const [signingId, setSigningId] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    let cancelled = false;
    apiClient
      .get<{ rows: AdmReferralRow[] }>("/api/adm/referrals/all", {
        params: { page: 1 },
      })
      .then((res) => {
        if (!cancelled) setDocs((res.data.rows ?? []).slice(0, 8));
      })
      .catch((err: unknown) => {
        console.error("[/api/adm/referrals/all] fetch failed:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => load(), [load]);

  const handleSign = (id: string) => {
    setSigningId(id);
    apiClient
      .post(`/api/adm/${id}/principal-approve`)
      .then(() => load())
      .catch((err: unknown) => {
        console.error("[/api/adm principal-approve] failed:", err);
      })
      .finally(() => setSigningId(null));
  };

  const pendingCount = docs.filter((d) => d.stage === "principal_approval").length;
  const signedCount = docs.filter((d) => d.approvedBy !== null).length;

  if (loading) {
    return (
      <div className={styles.admPanel}>
        <div className={styles.admHeader}>
          <div className={styles.admSummary}>
            <div className={styles.admSummaryItem}>
              <Skeleton className={styles.summaryValueSkeleton} />
              <span className={styles.admSummaryLabel}>At Principal</span>
            </div>
            <div className={styles.admSummaryItem}>
              <Skeleton className={styles.summaryValueSkeleton} />
              <span className={styles.admSummaryLabel}>Signed This Term</span>
            </div>
          </div>
        </div>
        <div className={styles.admList}>
          {Array.from({ length: 8 }).map((_, i) => (
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
        <Skeleton className={styles.admLegendSkeleton} />
        <Skeleton className={styles.tabLinkSkeleton} />
      </div>
    );
  }

  return (
    <div className={styles.admPanel}>
      <div className={styles.admHeader}>
        <div className={styles.admSummary}>
          <div className={styles.admSummaryItem}>
            <span
              className={styles.admSummaryDot}
              style={{ backgroundColor: STAGE_COLORS.principal_approval }}
              aria-hidden
            />
            <span className={styles.admSummaryValue}>{pendingCount}</span>
            <span className={styles.admSummaryLabel}>Pending at Principal</span>
          </div>
          <div className={styles.admSummaryItem}>
            <span
              className={styles.admSummaryDot}
              style={{ backgroundColor: "var(--primary)" }}
              aria-hidden
            />
            <span className={styles.admSummaryValue}>{signedCount}</span>
            <span className={styles.admSummaryLabel}>Signed This Term</span>
          </div>
        </div>

        <ul className={styles.admLegend}>
          {STAGE_LEGEND.map((s) => (
            <li key={s} className={styles.admLegendItem}>
              <span
                className={styles.admLegendDot}
                style={{ backgroundColor: STAGE_COLORS[s] }}
                aria-hidden
              />
              {stageLabel(s)}
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.admList}>
        {docs.map((d) => {
          const c = toCase(d);
          const awaiting = isAwaitingSignature(c);
          const atPrincipal = d.stage === "principal_approval";
          return (
            <div key={d.id} className={styles.admDoc}>
              <div className={styles.admDocMain}>
                <div className={styles.admDocTop}>
                  <span
                    className={`${styles.admStage} ${
                      atPrincipal ? styles.admStagePrincipal : ""
                    }`}
                    title={stageLabel(d.stage)}
                  >
                    <span
                      className={styles.admStageDot}
                      style={{
                        backgroundColor: STAGE_COLORS[d.stage],
                        color: STAGE_COLORS[d.stage],
                      }}
                      aria-hidden
                    />
                  </span>
                </div>
                <div className={styles.admDocMeta}>
                  <span className={styles.admDocName}>{d.student}</span>
                  <span className={styles.mono}>{d.lrn}</span>
                  <span>{d.grade}</span>
                </div>
              </div>
              {atPrincipal ? (
                <div className={styles.admActions}>
                  <Button
                    size="sm"
                    className={styles.admSign}
                    disabled={signingId === d.id || !awaiting}
                    onClick={() => handleSign(d.id)}
                  >
                    {awaiting ? "Sign" : "Signed"}
                  </Button>
                  <a className={styles.admView} href={href}>
                    View
                  </a>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
