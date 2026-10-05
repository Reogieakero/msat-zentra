"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ALL_GRADES, type AttentionItem } from "./types";
import styles from "./academics.module.css";

export function SubjectSectionBreakdown({
  subject,
  gradeFilter,
  items,
  onClear,
}: {
  subject: string;
  gradeFilter: string;
  items: AttentionItem[];
  onClear: () => void;
}) {
  const scope = gradeFilter === ALL_GRADES ? "All grades" : gradeFilter;
  const worst = items.length > 0 ? items[0] : null;

  return (
    <Card className={styles.glowCard}>
      <span className={styles.glowClip} aria-hidden="true">
        <span className={styles.cardGlow} />
      </span>
      <CardHeader>
        <div className={styles.breakdownHead}>
          <div>
            <CardTitle>
              {subject} — {scope}
            </CardTitle>
            <CardDescription>
              {worst
                ? worst.avg < 75
                  ? `Most underperformed: ${worst.section} at ${worst.avg}. Sections ranked worst first.`
                  : `Every section is at or above 75 in ${subject}. Sections ranked lowest first.`
                : `No graded records for ${subject} in ${scope} yet.`}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            aria-label="Clear selected subject"
          >
            <X aria-hidden />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className={styles.clearNote}>
            No section has grades for {subject} yet — clear.
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th aria-label="Rank">#</th>
                  <th>Section</th>
                  <th>Average</th>
                  <th>Graded</th>
                  <th>Below 75</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr
                    key={item.sectionId}
                    className={i === 0 && item.avg < 75 ? styles.worstRow : ""}
                  >
                    <td className={styles.rankCell}>{i + 1}</td>
                    <td>{item.section}</td>
                    <td
                      className={
                        item.avg < 75 ? styles.avgBad : styles.avgGood
                      }
                    >
                      {item.avg}
                    </td>
                    <td>{item.graded}</td>
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
