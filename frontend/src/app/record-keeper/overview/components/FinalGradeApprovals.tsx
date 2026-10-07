"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api/client";
import { formatSection } from "@/lib/utils";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./FinalGradeApprovals.module.css";

const FETCH_PAGE_SIZE = 8;

interface ReadyStudentRow {
  id: string;
  lrn: string;
  name: string;
  gradeLevel: string;
  section: string;
  term: string;
  overall: number;
  status: "approved";
}

interface FinalGradesResponse {
  students: ReadyStudentRow[];
  total: number;
  ready: number;
  complete: number;
}

function fetchViewableFinals() {
  return apiClient
    .get<FinalGradesResponse>("/api/record-keeper/final-grades", {
      params: { page: 1, pageSize: FETCH_PAGE_SIZE },
    })
    .then((res) => res.data)
    .catch((err) => {
      console.error("[/api/record-keeper/final-grades] fetch failed:", err);
      throw err;
    });
}

export function FinalGradeApprovals() {
  const router = useRouter();
  const { data, isPending, isError } = useQuery({
    queryKey: ["record-keeper-final-grades"],
    queryFn: fetchViewableFinals,
  });

  const viewable = React.useMemo(
    () => (data?.students ?? []).slice(0, 6),
    [data]
  );

  const goFinals = React.useCallback(() => {
    router.push("/record-keeper/final-grades");
  }, [router]);

  return (
    <section className={assign.card} aria-labelledby="overview-finals-ready">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className={`${styles.header} relative`}>
        <div className={styles.headerText}>
          <h2 id="overview-finals-ready" className="text-base font-semibold">
            Final Grade Approvals
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Students whose grades are fully adviser-approved and ready for you to view.
          </p>
        </div>
      </div>
      <div className={`${styles.content} relative`}>
        {isPending ? (
          <div className={styles.skelWrap}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className={styles.skelRow} />
            ))}
          </div>
        ) : isError ? (
          <p className={styles.empty}>Could not load viewable finals.</p>
        ) : viewable.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon} aria-hidden>
              <GraduationCap />
            </span>
            <p className={styles.emptyTitle}>No complete grade sets yet</p>
            <p className={styles.emptyHint}>
              Students appear once every subject is adviser-approved.
            </p>
          </div>
        ) : (
          <ul className={styles.list}>
            {viewable.map((g) => (
              <li key={g.id} className={styles.item} onClick={goFinals}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{g.name}</span>
                  <span className={styles.itemMeta}>
                    {formatSection(g.section)} · {g.term}
                  </span>
                </div>
                <span className={styles.itemGrade}>{g.overall ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {viewable.length > 0 && (
        <div className={`${styles.footer} relative`}>
          <Button className={styles.footerBtn} onClick={goFinals}>
            View all finals
          </Button>
        </div>
      )}
    </section>
  );
}
