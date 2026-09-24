"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./coordinator-overview-states.module.css";

export function CoordinatorOverviewSkeleton() {
  return (
    <section className={styles.page} aria-busy="true">
      <div className={styles.kpiGrid} aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={styles.card}>
            <Skeleton style={{ width: "55%", height: "0.75rem" }} />
            <Skeleton
              style={{ width: "35%", height: "1.5rem", marginTop: "0.375rem" }}
            />
            <Skeleton
              style={{ width: "80%", height: "0.75rem", marginTop: "0.375rem" }}
            />
          </div>
        ))}
      </div>
      <div className={styles.railRow} aria-hidden="true">
        <div className={styles.card}>
          <Skeleton style={{ width: "12rem", height: "0.9375rem" }} />
          <Skeleton
            style={{ width: "100%", height: "10rem", marginTop: "0.75rem" }}
          />
          {[0, 1, 2].map((i) => (
            <Skeleton
              key={i}
              style={{ width: "100%", height: "1.25rem", marginTop: "0.5rem" }}
            />
          ))}
        </div>
        <div className={styles.card}>
          <Skeleton style={{ width: "16rem", height: "0.9375rem" }} />
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton
              key={i}
              style={{ width: "100%", height: "2rem", marginTop: "0.5rem" }}
            />
          ))}
        </div>
      </div>
      <div className={styles.card} aria-hidden="true">
        <Skeleton style={{ width: "16rem", height: "0.9375rem" }} />
        {[0, 1, 2].map((i) => (
          <Skeleton
            key={i}
            style={{ width: "100%", height: "2rem", marginTop: "0.5rem" }}
          />
        ))}
      </div>
    </section>
  );
}

export function CoordinatorOverviewError({
  onRetry,
  isRefetching,
}: {
  onRetry: () => void;
  isRefetching: boolean;
}) {
  return (
    <section className={styles.page}>
      <div className={styles.errorBlock} role="alert">
        <p className={styles.errorText}>
          We couldn&apos;t load the coordinator overview. Please check your
          internet connection and try again.
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={isRefetching}
          onClick={onRetry}
        >
          {isRefetching ? (
            <Loader2 className={styles.spin} aria-hidden="true" />
          ) : null}
          {isRefetching ? "Loading…" : "Try again"}
        </Button>
      </div>
    </section>
  );
}
