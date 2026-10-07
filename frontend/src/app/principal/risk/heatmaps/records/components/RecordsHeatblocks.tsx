"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { FolderCard } from "@/components/ui/FolderCard";
import { PrivacyNoticeDialog } from "@/components/privacy-notice-dialog";
import styles from "./RecordsHeatblocks.module.css";
import { CATEGORY_META, fetchRecords } from "./records-data";
import type { BehavioralRecord } from "../types";

const PAGE_SIZE = 21;

// File-slip tone follows severity so each folder reads urgency at a glance.
function severityTone(severity: BehavioralRecord["severity"]): 2 | 3 | 5 {
  if (severity === "High") return 5;
  if (severity === "Moderate") return 3;
  return 2;
}

export function RecordsHeatblocks() {
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  // Folders never open the full report on this desk — clicking one shows the
  // same privacy overlay the other roles use.
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
  const rangeStart = shownReports.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, shownReports.length);

  return (
    <>
    <section className={styles.panel} aria-label="Anecdotal records heatblocks">
      <div className={styles.header}>
        <div className={styles.headerActions}>
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
          <div className={styles.empty}>
            <CircleDot className={styles.emptyIcon} aria-hidden />
            <p>No reports match the current filters.</p>
          </div>
        ) : (
          <>
            <div className={styles.head}>
              <span className={styles.headCount}>
                {shownReports.length} reports
              </span>
            </div>
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
              <div className={styles.pager}>
                <p className={styles.range} aria-live="polite">
                  Showing {rangeStart}–{rangeEnd} of {shownReports.length}
                </p>
                <div className={styles.pagerButtons}>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
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