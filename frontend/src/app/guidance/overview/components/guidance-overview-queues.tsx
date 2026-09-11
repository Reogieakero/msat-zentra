"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  GuidanceAdmRow,
  GuidanceInterventionRow,
  GuidanceReferralRow,
} from "./guidance-overview-data";
import styles from "./guidance-overview-queues.module.css";

interface GuidanceOverviewQueuesProps {
  referralsQueue: GuidanceReferralRow[];
  interventionsQueue: GuidanceInterventionRow[];
  admQueue: GuidanceAdmRow[];
}

// "pending" -> "Pending", "in_progress" -> "In progress".
function formatStatus(value: string): string {
  const words = value.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={mono ? styles.detailValueMono : styles.detailValue}>{value}</span>
    </div>
  );
}

export function GuidanceOverviewQueues({
  referralsQueue,
  interventionsQueue,
  admQueue,
}: GuidanceOverviewQueuesProps) {
  return (
    <div className={styles.queueGrid}>
      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.sectionTitle}>Referrals waiting on you</CardTitle>
          <CardDescription className={styles.sectionDesc}>
            Newest cases routed to the guidance counselor.
          </CardDescription>
        </CardHeader>
        <CardContent className={styles.cardBody}>
          {referralsQueue.length === 0 ? (
            <p className={styles.empty}>No referrals routed to guidance.</p>
          ) : (
            <ul className={styles.list}>
              {referralsQueue.slice(0, 3).map((row) => (
                <li key={row.id} className={styles.listItem}>
                  <span className={styles.dot} aria-hidden />
                  <div className={styles.itemBody}>
                    <p className={styles.itemTitle}>
                      {row.student}{" "}
                      <Badge variant={row.status === "pending" ? "warning" : "secondary"}>
                        {formatStatus(row.status)}
                      </Badge>
                    </p>
                    <div className={styles.details}>
                      <DetailRow label="LRN" value={row.lrn || "—"} mono />
                      <DetailRow label="Section" value={row.section} />
                      <DetailRow label="Category" value={formatStatus(row.category)} />
                      <DetailRow label="Referred by" value={row.referredBy} />
                      <DetailRow label="Date" value={row.date} />
                    </div>
                    <p className={styles.excerpt}>{row.reason}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.actions}>
            <Button asChild size="sm" variant="outline">
              <Link href="/guidance/referrals">Open referrals</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.sectionTitle}>Open interventions</CardTitle>
          <CardDescription className={styles.sectionDesc}>
            Ongoing follow-ups owned by guidance.
          </CardDescription>
        </CardHeader>
        <CardContent className={styles.cardBody}>
          {interventionsQueue.length === 0 ? (
            <p className={styles.empty}>No ongoing interventions.</p>
          ) : (
            <ul className={styles.list}>
              {interventionsQueue.slice(0, 3).map((row) => (
                <li key={row.id} className={styles.listItem}>
                  <span className={styles.dot} aria-hidden />
                  <div className={styles.itemBody}>
                    <p className={styles.itemTitle}>
                      {row.student}{" "}
                      <Badge
                        variant={
                          row.level === "High"
                            ? "default"
                            : row.level === "Moderate"
                              ? "warning"
                              : "secondary"
                        }
                      >
                        {row.level}
                      </Badge>
                    </p>
                    <div className={styles.details}>
                      <DetailRow label="LRN" value={row.lrn || "—"} mono />
                      <DetailRow label="Section" value={row.section} />
                      <DetailRow label="Outcome" value={formatStatus(row.outcome)} />
                    </div>
                    <p className={styles.excerpt}>{row.action}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.actions}>
            <Button asChild size="sm" variant="outline">
              <Link href="/guidance/interventions">Open interventions</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.sectionTitle}>ADM hand-offs</CardTitle>
          <CardDescription className={styles.sectionDesc}>
            Active ADM cases that may need counselor action.
          </CardDescription>
        </CardHeader>
        <CardContent className={styles.cardBody}>
          {admQueue.length === 0 ? (
            <p className={styles.empty}>No active ADM cases.</p>
          ) : (
            <ul className={styles.list}>
              {admQueue.slice(0, 3).map((row) => (
                <li key={row.id} className={styles.listItem}>
                  <span className={styles.dot} aria-hidden />
                  <div className={styles.itemBody}>
                    <p className={styles.itemTitle}>{row.student}</p>
                    <div className={styles.details}>
                      <DetailRow label="LRN" value={row.lrn || "—"} mono />
                      <DetailRow label="Grade" value={row.grade} />
                      <DetailRow label="Stage" value={row.stageLabel} />
                      <DetailRow label="Eligibility" value={formatStatus(row.eligibility)} />
                      <DetailRow label="Date" value={row.date} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.actions}>
            <Button asChild size="sm" variant="outline">
              <Link href="/guidance/adm">Open ADM cases</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
