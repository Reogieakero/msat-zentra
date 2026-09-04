"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock } from "lucide-react";
import {
  CATEGORY_COLORS,
  formatRecordDate,
  humanize,
  type AnecdotalRecord,
} from "./anecdotal-data";
import styles from "./AnecdotalList.module.css";

interface AnecdotalListProps {
  records: AnecdotalRecord[];
  loading: boolean;
}

export function AnecdotalList({ records, loading }: AnecdotalListProps) {
  if (loading) {
    return (
      <div className={styles.list} aria-busy="true" aria-label="Loading anecdotal records">
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.card} aria-hidden>
            <div className={styles.cardHead}>
              <Skeleton className={styles.skelBadge} />
              <Skeleton className={styles.skelBadge} />
              <Skeleton className={styles.skelDate} />
            </div>
            <Skeleton className={styles.skelLine} />
            <Skeleton className={styles.skelLine} />
            <Skeleton className={styles.skelLineShort} />
          </div>
        ))}
      </div>
    );
  }

  if (records.length === 0) {
    return <p className={styles.empty}>No anecdotal records this term.</p>;
  }

  return (
    <ul className={styles.list}>
      {records.map((r) => (
        <li
          key={r.id}
          className={styles.card}
          style={{ "--record": CATEGORY_COLORS[r.category] ?? "var(--primary)" } as React.CSSProperties}
        >
          <div className={styles.cardHead}>
            <Badge variant="outline" className={styles.categoryBadge}>
              {humanize(r.category)}
            </Badge>
            <Badge variant="secondary">{humanize(r.confidentialityLevel)}</Badge>
            {r.mine ? <Badge variant="default">Yours</Badge> : null}
            <span className={styles.date}>{formatRecordDate(r.observationDatetime)}</span>
          </div>

          {r.mine ? (
            <div className={styles.recordBody}>
              {r.location ? (
                <p className={styles.location}>{r.location}</p>
              ) : null}
              <p className={styles.incident}>{r.incident}</p>
              {r.notes ? <p className={styles.notes}>{r.notes}</p> : null}
              {r.classPerformance ? (
                <p className={styles.detail}>
                  <span className={styles.detailLabel}>Class performance: </span>
                  {r.classPerformance}
                </p>
              ) : null}
              {r.attendanceSummary ? (
                <p className={styles.detail}>
                  <span className={styles.detailLabel}>Attendance: </span>
                  {r.attendanceSummary}
                </p>
              ) : null}
              {r.followups && r.followups.length > 0 ? (
                <ul className={styles.followups}>
                  {r.followups.map((f) => (
                    <li key={f.id} className={styles.followup}>
                      <span className={styles.followupHead}>
                        {f.by} · {formatRecordDate(f.date)}
                      </span>
                      <span className={styles.followupNotes}>{f.notes}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className={styles.restricted}>
              <Lock className={styles.lockIcon} aria-hidden />
              Details are restricted to the recording observer
              {typeof r.followupCount === "number" && r.followupCount > 0
                ? ` · ${r.followupCount} follow-up${r.followupCount === 1 ? "" : "s"} on file`
                : ""}
              .
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
