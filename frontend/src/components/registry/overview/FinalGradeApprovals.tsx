"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FileSignature, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { apiClient } from "@/lib/api/client";
import { formatSection } from "@/lib/utils";
import type { RegistryDesk } from "@/services/registry/overview.service";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./FinalGradeApprovals.module.css";
import { PAGE_SIZE as FETCH_PAGE_SIZE } from "@/components/shared/pagination";

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

// Kanban preview (record-keeper overview) shows only the first three ready
// rows — same trim as the SF10 attach feed beside it. The glow variant
// (registrar) keeps its longer preview.
const KANBAN_ROW_LIMIT = 3;

function fetchViewableFinals(desk: RegistryDesk) {
  return apiClient
    .get<FinalGradesResponse>(`/api/${desk}/final-grades`, {
      params: { page: 1, pageSize: FETCH_PAGE_SIZE },
    })
    .then((res) => res.data)
    .catch((err) => {
      console.error(`[/api/${desk}/final-grades] fetch failed:`, err);
      throw err;
    });
}

export function FinalGradeApprovals({
  desk,
  variant = "glow",
}: {
  desk: RegistryDesk;
  /**
   * "glow" (default) — legacy registry glow card.
   * "kanban" — kanban shell (record keeper), header + count like the KPI
   * board columns.
   */
  variant?: "glow" | "kanban";
}) {
  const kanban = variant === "kanban";
  const router = useRouter();
  const { data, isPending, isError } = useQuery({

    queryKey: [`${desk}-final-grades`, "preview"],
    queryFn: () => fetchViewableFinals(desk),
    staleTime: 30_000,
  });

  const viewable = React.useMemo(
    () => (data?.students ?? []).slice(0, kanban ? KANBAN_ROW_LIMIT : 6),
    [data, kanban]
  );

  const goFinals = React.useCallback(() => {
    router.push(`/${desk}/final-grades`);
  }, [router, desk]);

  const isEmpty = !isPending && !isError && viewable.length === 0;

  const body = isPending ? (
    <div className={styles.skelWrap}>
      {Array.from({ length: kanban ? KANBAN_ROW_LIMIT : 5 }).map((_, i) => (
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
              <span className={styles.metaPill}>{formatSection(g.section)}</span>
              <span className={styles.metaPill}>{g.term}</span>
            </span>
          </div>
          <span className={styles.itemGrade}>{g.overall ?? "—"}</span>
        </li>
      ))}
    </ul>
  );

  if (kanban) {
    return (
      <KanbanBoard
        className="flex-1"
        title="Final Grade Approvals"
        icon={
          <span className="text-primary" aria-hidden>
            <FileSignature size={14} />
          </span>
        }
        count={isPending ? undefined : (data?.complete ?? "—")}
        description="Students whose grades are fully adviser-approved and ready for you to view."
      >
        <div className={styles.kanbanBody}>{body}</div>
        {viewable.length > 0 && (
          <div className={styles.kanbanFooter}>
            <Button className={styles.footerBtn} onClick={goFinals}>
              View all finals
            </Button>
          </div>
        )}
      </KanbanBoard>
    );
  }

  return (
    <section className={assign.card} aria-labelledby={isEmpty ? undefined : "overview-finals-ready"}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      {!isEmpty && (
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
      )}
      <div className={`${styles.content} relative`}>{body}</div>
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
