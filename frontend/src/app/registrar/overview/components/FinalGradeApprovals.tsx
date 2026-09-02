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

interface PendingGradeRow {
  id: string;
  lrn: string;
  name: string;
  gradeLevel: string;
  section: string;
  subject: string;
  term: string;
  transmutedGrade: number;
  status: "pending" | "approve";
}

interface FinalGradesResponse {
  grades: PendingGradeRow[];
  total: number;
  pending: number;
  approved: number;
}

function fetchPendingFinals() {
  return apiClient
    .get<FinalGradesResponse>("/api/registrar/final-grades", {
      params: { page: 1, pageSize: FETCH_PAGE_SIZE, filter: "pending" },
    })
    .then((res) => res.data)
    .catch((err) => {
      console.error("[/api/registrar/final-grades] fetch failed:", err);
      throw err;
    });
}

export function FinalGradeApprovals() {
  const router = useRouter();
  const { data, isPending, isError } = useQuery({
    queryKey: ["registrar-final-grades", "pending"],
    queryFn: fetchPendingFinals,
  });

  const pending = React.useMemo(
    () => (data?.grades ?? []).slice(0, 6),
    [data]
  );

  const goFinals = React.useCallback(() => {
    router.push("/registrar/final-grades");
  }, [router]);

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <CardTitle>Final Grade Approvals</CardTitle>
          <CardDescription>
            Latest finals approved by advisers, awaiting your sign-off.
          </CardDescription>
        </div>
        <CardAction>
          <Badge variant="warning" className={styles.pendingBadge}>
            {isPending ? "…" : data?.pending ?? 0}
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
          <p className={styles.empty}>Could not load pending finals.</p>
        ) : pending.length === 0 ? (
          <p className={styles.empty}>
            All caught up — no finals awaiting your approval.
          </p>
        ) : (
          <ul className={styles.list}>
            {pending.map((g) => (
              <li key={g.id} className={styles.item} onClick={goFinals}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{g.name}</span>
                  <span className={styles.itemMeta}>
                    {formatSection(g.section)} · {g.subject} · {g.term}
                  </span>
                </div>
                <span className={styles.itemGrade}>{g.transmutedGrade ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter className={styles.footer}>
        <Button variant="outline" className={styles.footerBtn} onClick={goFinals}>
          Review all finals
        </Button>
      </CardFooter>
    </Card>
  );
}