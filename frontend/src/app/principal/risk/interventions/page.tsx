"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from "@/components/ui/command";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationLink,
} from "@/components/ui/pagination";
import { fetchInterventionStudents } from "./api";
import type { RiskSnapshotStudent, GradeMode } from "./types";
import { useGradeMode } from "../../grade-mode-context";
import { InterventionsTable } from "./components/InterventionsTable";
import { InterventionDrawer } from "./components/InterventionDrawer";
import menu from "../heatmaps/components/heatmap.module.css";
import styles from "./interventions.module.css";

const PAGE_SIZE = 20;

export default function PrincipalInterventionsPage() {
  const { gradeMode } = useGradeMode();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<RiskSnapshotStudent[]>([]);
  const [total, setTotal] = React.useState(0);
  const [highModerate, setHighModerate] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<RiskSnapshotStudent | null>(null);

  const load = React.useCallback(
    (_q: string, p: number, mode: GradeMode) => {
      setLoading(true);
      setError(null);
      fetchInterventionStudents({ gradeMode: mode }, p, PAGE_SIZE)
        .then((res) => {
          setRows(res.students);
          setTotal(res.total);
          setHighModerate(res.highModerate);
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
    load("", 1, gradeMode);
  }, [load, gradeMode]);

  // Client-side search by student name / LRN.
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.studentName.toLowerCase().includes(q) || r.lrn.toLowerCase().includes(q)
    );
  }, [rows, query]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const goTo = (p: number) => {
    const next = Math.min(Math.max(1, p), totalPages);
    setPage(next);
    load(query, next, gradeMode);
  };

  return (
    <div className={menu.shell}>
      <div className={menu.layout}>
        <section className={styles.page}>
          <header className={styles.head}>
            <div className={styles.headText}>
              <h1 className={styles.title}>Interventions</h1>
              <p className={styles.subtitle}>
                School-wide at-risk students · track progress
              </p>
            </div>
            <div className={styles.toolbarMeta}>
              {loading ? (
                <Skeleton style={{ width: 90, height: 12 }} />
              ) : (
                `${highModerate} at-risk · ${total} shown`
              )}
            </div>
          </header>

          <div className={styles.toolbar}>
            <Command className={styles.search}>
              <CommandInput
                placeholder="Search by student name or LRN…"
                value={query}
                onValueChange={setQuery}
              />
              <CommandList className={styles.searchList}>
                <CommandEmpty>No matching students.</CommandEmpty>
                {filtered.map((r) => (
                  <CommandItem
                    key={r.studentId}
                    value={`${r.studentName} ${r.lrn}`}
                    onSelect={() => setSelected(r)}
                  >
                    <span className={styles.searchName}>{r.studentName}</span>
                    <span className={styles.searchLrn}>{r.lrn}</span>
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </div>

          <InterventionsTable
            rows={filtered}
            loading={loading}
            error={error}
            onSelect={setSelected}
          />

          {!loading && !error && totalPages > 1 ? (
            <Pagination className={styles.pager}>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => goTo(page - 1)}
                    className={page <= 1 ? styles.disabled : undefined}
                    aria-disabled={page <= 1}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink isActive={false} onClick={() => goTo(page)}>
                    Page {page} of {totalPages}
                  </PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={() => goTo(page + 1)}
                    className={page >= totalPages ? styles.disabled : undefined}
                    aria-disabled={page >= totalPages}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </section>
      </div>

      <InterventionDrawer student={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
