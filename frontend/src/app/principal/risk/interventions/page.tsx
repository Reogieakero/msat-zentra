"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchInterventionStudents } from "./api";
import type { RiskSnapshotStudent, GradeMode } from "./types";
import { useGradeMode } from "../../grade-mode-context";
import { InterventionFilters } from "./components/InterventionFilters";
import { InterventionsTable } from "./components/InterventionsTable";
import { InterventionDrawer } from "./components/InterventionDrawer";
import menu from "../heatmaps/components/heatmap.module.css";
import styles from "./interventions.module.css";

type Filters = {
  riskLevel: "all" | "Moderate" | "High";
  hasIntervention: boolean | undefined;
  factor: "all" | "Academic" | "Attendance" | "Behavioral";
};

const EMPTY_FILTERS: Filters = {
  riskLevel: "all",
  hasIntervention: undefined,
  factor: "all",
};

const PAGE_SIZE = 20;

export default function PrincipalInterventionsPage() {
  const { gradeMode } = useGradeMode();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<RiskSnapshotStudent[]>([]);
  const [total, setTotal] = React.useState(0);
  const [highModerate, setHighModerate] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS);
  const [selected, setSelected] = React.useState<RiskSnapshotStudent | null>(null);

  const load = React.useCallback(
    (f: Filters, p: number, mode: GradeMode) => {
      setLoading(true);
      setError(null);
      fetchInterventionStudents({ ...f, gradeMode: mode }, p, PAGE_SIZE)
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
    load(EMPTY_FILTERS, 1, gradeMode);
  }, [load, gradeMode]);

  const onFiltersChange = (next: Filters) => {
    setFilters(next);
    load(next, 1, gradeMode);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className={menu.shell}>
      <div className={menu.layout}>
        <section className={styles.page}>
          <header className={styles.head}>
            <div className={styles.headText}>
              <h1 className={styles.title}>Interventions</h1>
              <p className={styles.subtitle}>
                School-wide at-risk students · assign &amp; track
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

          <InterventionFilters value={filters} onChange={onFiltersChange} />

          <InterventionsTable
            rows={rows}
            loading={loading}
            error={error}
            onSelect={setSelected}
          />

          {!loading && !error && totalPages > 1 ? (
            <div className={styles.pager}>
              <button
                type="button"
                className={styles.pagerBtn}
                disabled={page <= 1}
                onClick={() => load(filters, page - 1, gradeMode)}
              >
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className={styles.pagerBtn}
                disabled={page >= totalPages}
                onClick={() => load(filters, page + 1, gradeMode)}
              >
                Next
              </button>
            </div>
          ) : null}
        </section>
      </div>

      <InterventionDrawer
        student={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
