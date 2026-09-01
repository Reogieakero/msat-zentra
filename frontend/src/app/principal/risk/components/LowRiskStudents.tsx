import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLowRiskStudents } from "../riskBoard";
import styles from "./low-risk-students.module.css";

const PAGE_SIZE = 15;

export function LowRiskStudents() {
  const { students, total, page, totalPages, setPage, loading, error } =
    useLowRiskStudents(PAGE_SIZE);

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <CardTitle>Low-Risk Students</CardTitle>
      </CardHeader>
      <CardContent className={styles.content}>
        {error ? (
          <p className={styles.error}>{error}</p>
        ) : loading ? (
          <ul className={styles.list}>
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <li key={i} className={styles.item}>
                <Skeleton className={styles.skelDot} />
                <Skeleton className={styles.skelLrn} />
              </li>
            ))}
          </ul>
        ) : students.length === 0 ? (
          <p className={styles.empty}>No low-risk students recorded.</p>
        ) : (
          <ul className={styles.list}>
            {students.map((s) => (
              <li key={s.lrn} className={styles.item}>
                <span className={styles.dot} aria-hidden />
                <span className={styles.lrn}>{s.name}</span>
              </li>
            ))}
          </ul>
        )}

        {!loading && total > 0 && (
          <div className={styles.pager}>
            <span className={styles.pageInfo}>
              {from}–{to} of {total}
            </span>
            <div className={styles.pageBtns}>
              <button
                type="button"
                className={styles.pageBtn}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <span className={styles.pageNum}>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                className={styles.pageBtn}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
