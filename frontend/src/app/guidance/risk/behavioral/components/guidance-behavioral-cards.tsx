"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GuidanceAnecdotalRecord } from "../../../anecdotal/components/guidance-anecdotal-data";
import styles from "./guidance-behavioral-cards.module.css";

function capitalize(value: string): string {
  return value
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function statusVariant(status: string): "warning" | "outline" | "success" | "secondary" {
  if (status === "pending") return "warning";
  if (status === "in_progress") return "outline";
  if (status === "resolved") return "success";
  return "secondary";
}

interface GuidanceBehavioralCardsProps {
  records: GuidanceAnecdotalRecord[];
}

/**
 * Behavioral signal feed as cards — identity header, labeled detail grid,
 * and status badges. Category + tier only, never the clinical write-up.
 */
export function GuidanceBehavioralCards({ records }: GuidanceBehavioralCardsProps) {
  return (
    <ul className={styles.grid}>
      {records.map((row) => (
        <li key={row.id} className={styles.card}>
          <div className={styles.top}>
            <div className={styles.identity}>
              <p className={styles.name}>{row.student}</p>
              <p className={styles.lrn}>{row.lrn}</p>
            </div>
            <Badge variant="secondary" className={styles.category}>
              {capitalize(row.category)}
            </Badge>
          </div>

          <dl className={styles.meta}>
            <div className={styles.metaItem}>
              <dt>Section</dt>
              <dd>{row.section}</dd>
            </div>
            <div className={styles.metaItem}>
              <dt>Grade</dt>
              <dd>{row.grade}</dd>
            </div>
            <div className={styles.metaItem}>
              <dt>Observed by</dt>
              <dd>{row.observer}</dd>
            </div>
            <div className={styles.metaItem}>
              <dt>Referred by</dt>
              <dd>{row.referredBy}</dd>
            </div>
            <div className={styles.metaItem}>
              <dt>Date filed</dt>
              <dd>{row.date}</dd>
            </div>
            <div className={styles.metaItem}>
              <dt>Confidentiality</dt>
              <dd>{capitalize(row.confidentiality)}</dd>
            </div>
          </dl>

          <div className={styles.foot}>
            <Badge variant={statusVariant(row.referralStatus)}>
              Referral {capitalize(row.referralStatus)}
            </Badge>
            <span className={styles.spacer} />
            <Button size="xs" variant="outline" asChild>
              <Link href="/guidance/referrals">Open referral</Link>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
