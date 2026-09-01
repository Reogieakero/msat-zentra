"use client";

import * as React from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationLink,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { fetchInterventionStudents } from "./api";
import type { RiskSnapshotStudent, GradeMode } from "./types";
import { useGradeMode } from "../../grade-mode-context";
import { InterventionsTable } from "./components/InterventionsTable";
import { InterventionDrawer } from "./components/InterventionDrawer";
import menu from "../heatmaps/components/heatmap.module.css";
import styles from "./interventions.module.css";

const PAGE_SIZE = 20;

function pageItems(current: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items: (number | "ellipsis")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  if (start > 2) items.push("ellipsis");
  for (let p = start; p <= end; p++) items.push(p);
  if (end < totalPages - 1) items.push("ellipsis");
  items.push(totalPages);
  return items;
}

export default function PrincipalInterventionsPage() {
  const { gradeMode } = useGradeMode();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<RiskSnapshotStudent[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<RiskSnapshotStudent | null>(null);
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.studentName.toLowerCase().includes(q) ||
        r.lrn.toLowerCase().includes(q) ||
        r.section.toLowerCase().includes(q)
    );
  }, [rows, query]);

  const load = React.useCallback(
    (p: number, mode: GradeMode) => {
      setLoading(true);
      setError(null);
      fetchInterventionStudents({ gradeMode: mode }, p, PAGE_SIZE)
        .then((res) => {
          setRows(res.students);
          setTotal(res.total);
          setPage(res.page);
        })
        .catch((err: unknown) => {
          const status = (err as { response?: { status?: number } })?.response?.status;
          setError(
            status
              ? `Failed to load interventions (HTTP ${status})`
              : "Failed to load interventions"
          );
          console.error("[/api/risk/interventions] fetch failed:", err);
        })
        .finally(() => setLoading(false));
    },
    []
  );

  React.useEffect(() => {
    load(1, gradeMode);
  }, [load, gradeMode]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const goTo = (p: number) => {
    const next = Math.min(Math.max(1, p), totalPages);
    setPage(next);
    load(next, gradeMode);
  };

  return (
    <div className={menu.shell}>
      <div className={menu.layout}>
        <section className={styles.page}>
          <header className={styles.head}>
            <div className={styles.headText}>
              <h1 className={styles.title}>Interventions</h1>
              <p className={styles.subtitle}>
                Early-intervention progress tracking
              </p>
            </div>
          </header>

          <InterventionsTable
            rows={filtered}
            loading={loading}
            error={error}
            query={query}
            onSearchChange={setQuery}
            onSelect={setSelected}
          />

          {!loading && !error && totalPages > 1 ? (
            <Pagination className={styles.pager}>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => goTo(page - 1)}
                    aria-disabled={page <= 1}
                    className={page <= 1 ? styles.pageDisabled : undefined}
                  />
                </PaginationItem>
                {pageItems(page, totalPages).map((p, i) =>
                  p === "ellipsis" ? (
                    <PaginationItem key={`e${i}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={p}>
                      <PaginationLink
                        isActive={p === page}
                        onClick={() => goTo(p as number)}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => goTo(page + 1)}
                    aria-disabled={page >= totalPages}
                    className={page >= totalPages ? styles.pageDisabled : undefined}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </section>
      </div>

      <InterventionDrawer
        student={selected}
        gradeMode={gradeMode}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
