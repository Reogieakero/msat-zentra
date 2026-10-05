"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AttentionItem } from "./types";
import styles from "./academics.module.css";

export function NeedsAttentionList({
  items,
  isPending,
}: {
  items: AttentionItem[];
  isPending: boolean;
}) {
  return (
    <Card className={styles.glowCard}>
      <span className={styles.glowClip} aria-hidden="true">
        <span className={styles.cardGlow} />
      </span>
      <CardHeader>
        <div>
          <CardTitle>Needs attention</CardTitle>
          <CardDescription>
            Lowest section–subject averages below 75.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Skeleton className={styles.kpiSkel} aria-hidden />
        ) : items.length === 0 ? (
          <p className={styles.clearNote}>
            All sections are at or above 75 — clear.
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Subject</th>
                  <th>Average</th>
                  <th>Below 75</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.sectionId}::${item.subject}`}>
                    <td>{item.section}</td>
                    <td>{item.subject}</td>
                    <td className={styles.avgBad}>{item.avg}</td>
                    <td>{item.below}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
