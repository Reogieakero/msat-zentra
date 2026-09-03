"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api/client";
import { formatSection } from "@/lib/utils";
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
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <CardTitle>Final Grade Approvals</CardTitle>
          <CardDescription>
            Students whose grades are fully adviser-approved and ready for you to view.
          </CardDescription>
        </div>
        <CardAction>
          <Badge variant="default" className={styles.pendingBadge}>
            {isPending ? "…" : data?.complete ?? 0}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className={styles.content}>
        {isPending ? (
          <div className={styles.skelWrap}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className={styles.skelRow} />
            ))}
          </div>
        ) : isError ? (
          <p className={styles.empty}>Could not load viewable finals.</p>
        ) : viewable.length === 0 ? (
          <p className={styles.empty}>
            No complete grade sets yet. Students appear once all their subjects are adviser-approved.
          </p>
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
      </CardContent>
      <CardFooter className={styles.footer}>
        <Button variant="outline" className={styles.footerBtn} onClick={goFinals}>
          View all finals
        </Button>
      </CardFooter>
    </Card>
  );
}