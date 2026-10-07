"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchRegistrarOverview } from "@/services/registry/overview.service";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./AdviserAccessCard.module.css";

export function AdviserAccessCard() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["registrar-overview"],
    queryFn: fetchRegistrarOverview,
    staleTime: 30_000,
  });

  const pending = data?.pendingAdviserAccess ?? 0;

  return (
    <section className={assign.card} aria-labelledby="overview-adviser-access">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className={`${styles.header} relative`}>
        <div className={styles.headerText}>
          <h2 id="overview-adviser-access" className="text-base font-semibold">
            Adviser Access Requests
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Adviser SF10 read-access requests waiting for your decision.
          </p>
        </div>
      </div>
      <div className={`${styles.body} relative`}>
        {isPending ? (
          <Skeleton className={styles.skelCount} />
        ) : isError ? (
          <p className={styles.empty}>Could not load access requests.</p>
        ) : pending === 0 ? (
          <div className={styles.emptyBlock}>
            <span className={styles.emptyIcon} aria-hidden>
              <ShieldCheck />
            </span>
            <p className={styles.emptyTitle}>All caught up</p>
            <p className={styles.hint}>
              No adviser requests awaiting review.
            </p>
          </div>
        ) : (
          <>
            <p className={styles.count} aria-live="polite">
              {pending}
              <span className={styles.countLabel}>
                {" "}
                pending request{pending !== 1 ? "s" : ""}
              </span>
            </p>
            <p className={styles.hint}>
              Review each adviser&apos;s section and learner records before approving.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
