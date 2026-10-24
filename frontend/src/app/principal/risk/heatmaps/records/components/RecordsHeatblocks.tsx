"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, CircleDot, FileText } from "lucide-react";
import { PrincipalEmptyState } from "../../../../components/PrincipalEmptyCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { FolderCard } from "@/components/ui/FolderCard";
import { PrivacyNoticeDialog } from "@/components/privacy-notice-dialog";
import styles from "./RecordsHeatblocks.module.css";
import { CATEGORY_META, fetchRecords } from "@/services/principal/records.service";
import type { BehavioralRecord } from "../types";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";



function severityTone(severity: BehavioralRecord["severity"]): 2 | 3 | 5 {
  if (severity === "High") return 5;
  if (severity === "Moderate") return 3;
  return 2;
}

export function RecordsHeatblocks() {
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);

  const [privacyFor, setPrivacyFor] = React.useState<string | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ["records-heatmap"],
    queryFn: fetchRecords,
  });

  const sections = React.useMemo(() => data?.sections ?? [], [data]);

  const shownReports = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return sections
      .flatMap((s) => s.students)
      .flatMap((st) => st.behavioral.map((rec) => ({ student: st, rec })))
      .filter(({ student }) =>
        q
          ? student.lrn.toLowerCase().includes(q) ||
            student.name.toLowerCase().includes(q)
          : true
      );
  }, [sections, query]);

  const totalPages = Math.max(1, Math.ceil(shownReports.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedReports = shownReports.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  return (
    <>
    <section className={styles.panel} aria-label="Anecdotal records heatblocks">
      <div className={styles.header}>
        <div className={styles.headerActions}>
          <span className={styles.headCount} aria-live="polite">
            {shownReports.length} report{shownReports.length === 1 ? "" : "s"}
          </span>
          <div className={styles.search}>
            <Search className={styles.searchIcon} aria-hidden />
            <Input
              type="search"
              placeholder="Search LRN or name"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              aria-label="Search students"
              className={styles.searchInput}
            />
          </div>
        </div>
      </div>

      <div className={styles.content}>
        {isPending ? (
          <div className={styles.grid} aria-busy="true" aria-label="Loading student records">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={styles.skelFolder}>
                <Skeleton className={styles.skelFolderShape} />
                <Skeleton className={styles.skelFolderLabel} />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className={styles.empty}>
            <CircleDot className={styles.emptyIcon} aria-hidden />
            <p>Could not load student records.</p>
          </div>
        ) : shownReports.length === 0 ? (
          <PrincipalEmptyState
            icon={FileText}
            title="No reports found"
            hint={
              query.trim()
                ? `No reports match “${query.trim()}”.`
                : "No reports match the current filters."
            }
          />
        ) : (
          <>
            <div className={styles.grid}>
              {pagedReports.map(({ student: s, rec }, i) => {
                return (
                  <button
                    key={rec.id}
                    type="button"
                    className={styles.folderBtn}
                    style={{ animationDelay: `${Math.min(i, 24) * 18}ms` }}
                    onClick={() => setPrivacyFor(s.name)}
                    aria-label={`${s.name}, LRN ${s.lrn}, ${CATEGORY_META[rec.category].label} report from ${rec.date}`}
                  >
                    <FolderCard
                      label={s.name}
                      sublabel={`${s.lrn} · ${s.section}`}
                      cornerTag={CATEGORY_META[rec.category].label}
                      folderColor={CATEGORY_META[rec.category].color}
                      files={[
                        {
                          name: rec.date,
                          tag: `${CATEGORY_META[rec.category].label} • ${rec.severity}`,
                          icon: "doc" as const,
                          tone: severityTone(rec.severity),
                        },
                      ]}
                    />
                  </button>
                );
              })}
              {Array.from({ length: PAGE_SIZE - pagedReports.length }).map((_, i) => (
                <span
                  key={`page-filler-${i}`}
                  aria-hidden="true"
                  className={styles.gridFiller}
                >
                  <FolderCard label={"\u00A0"} sublabel={"\u00A0"} files={[]} />
                </span>
              ))}
            </div>
            {totalPages > 1 ? (
              <Pagination
                currentPage={safePage}
                totalItems={shownReports.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}

      </div>
    </section>

      <PrivacyNoticeDialog
        open={privacyFor !== null}
        onClose={() => setPrivacyFor(null)}
        studentName={privacyFor ?? undefined}
        reason="principal"
      />
    </>
  );
}
