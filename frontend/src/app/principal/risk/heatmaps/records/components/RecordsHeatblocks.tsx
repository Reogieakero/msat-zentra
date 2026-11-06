"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleDot, FileText, Search } from "lucide-react";
import { PrincipalEmptyState } from "../../../../components/PrincipalEmptyCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { PrivacyNoticeDialog } from "@/components/privacy-notice-dialog";
import {
  AnecdotalRecordKanbanCard,
  humanizeCategory,
} from "@/components/anecdotal/anecdotal-record-kanban-card";
import styles from "./RecordsHeatblocks.module.css";
import { CATEGORY_META, fetchRecords } from "@/services/principal/records.service";
import { Pagination } from "@/components/shared/pagination";

const RECORDS_PAGE_SIZE = 16;

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

  const totalPages = Math.max(1, Math.ceil(shownReports.length / RECORDS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedReports = shownReports.slice(
    (safePage - 1) * RECORDS_PAGE_SIZE,
    safePage * RECORDS_PAGE_SIZE
  );

  return (
    <>
      <KanbanBoard
        title="Anecdotal Records"
        icon={<FileText size={14} aria-hidden="true" />}
        actions={
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
              className={`${styles.searchInput} rounded-[16px]`}
              style={{ height: "2rem" }}
            />
          </div>
        }
        ariaLabel="Anecdotal records"
      >
        {isPending ? (
          <div
            className={styles.grid}
            aria-busy="true"
            aria-label="Loading student records"
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={styles.skelCard}>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-24 w-full" />
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
            <div className={styles.grid} role="list" aria-label="Anecdotal records">
              {pagedReports.map(({ student: s, rec }, i) => (
                <div
                  key={rec.id}
                  role="listitem"
                  className={styles.cardSlot}
                  style={{ animationDelay: `${Math.min(i, 24) * 55}ms` }}
                >
                  <AnecdotalRecordKanbanCard
                    category={rec.category}
                    headerTitle={CATEGORY_META[rec.category].label}
                    studentName={s.name}
                    plainName
                    mascotSeed={s.lrn}
                    mascotCharacter={s.mascot ?? undefined}
                    lrn={s.lrn}
                    metaText={s.section}
                    metaLabel="Section"
                    metaTone="amber"
                    layout="folder-left"
                    fileName={rec.date}
                    fileTag={`${humanizeCategory(rec.category)} • ${rec.severity}`}
                    openLabel={`${s.name}, LRN ${s.lrn}, ${CATEGORY_META[rec.category].label} report from ${rec.date}`}
                    onOpen={() => setPrivacyFor(s.name)}
                  />
                </div>
              ))}
            </div>
            {totalPages > 1 ? (
              <Pagination
                currentPage={safePage}
                totalItems={shownReports.length}
                pageSize={RECORDS_PAGE_SIZE}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </KanbanBoard>

      <PrivacyNoticeDialog
        open={privacyFor !== null}
        onClose={() => setPrivacyFor(null)}
        studentName={privacyFor ?? undefined}
        reason="principal"
      />
    </>
  );
}
