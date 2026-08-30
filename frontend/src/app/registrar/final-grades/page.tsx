"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { SearchIcon, ChevronDown } from "lucide-react";
import { FinalGradeApprovalTable } from "./components/FinalGradeApprovalTable";
import { KpiThreadsCard } from "./components/KpiThreadsCard";
import { FinalGradesPagination } from "./components/FinalGradesPagination";
import { apiClient } from "@/lib/api/client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type FinalGrade,
  type FinalGradesResponse,
} from "./components/types";
import styles from "./final-grades.module.css";

type StatusFilter = "all" | "pending" | "approve";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approve", label: "Approved" },
];

const EMPTY: FinalGradesResponse = { grades: [], total: 0, page: 1, pageSize: 50 };

export default function FinalGradeApprovalsPage() {
  const [grades, setGrades] = React.useState<FinalGrade[]>(EMPTY.grades);
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [approving, setApproving] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(50);

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .get<FinalGradesResponse>("/api/registrar/final-grades", { params: { page: 1, pageSize } })
      .then((res) => {
        if (cancelled) return;
        setGrades(res.data.grades);
        setTotal(res.data.total);
        setPage(res.data.page);
        setPageSize(res.data.pageSize);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const statusCode = (err as { response?: { status?: number } })?.response?.status;
        setError(
          statusCode
            ? `Failed to load final grades (HTTP ${statusCode})`
            : "Failed to load final grades"
        );
        console.error("[/api/registrar/final-grades] fetch failed:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = React.useCallback((p: number) => {
    setError(null);
    apiClient
      .get<FinalGradesResponse>("/api/registrar/final-grades", { params: { page: p, pageSize } })
      .then((res) => {
        setGrades(res.data.grades);
        setTotal(res.data.total);
        setPage(res.data.page);
        setPageSize(res.data.pageSize);
      })
      .catch((err: unknown) => {
        const statusCode = (err as { response?: { status?: number } })?.response?.status;
        setError(
          statusCode
            ? `Failed to load final grades (HTTP ${statusCode})`
            : "Failed to load final grades"
        );
        console.error("[/api/registrar/final-grades] fetch failed:", err);
      })
      .finally(() => setLoading(false));
  }, [pageSize]);

  const handleApprove = async (id: string) => {
    setApproving(id);
    try {
      await apiClient.post(`/api/grades/final-grades/${id}/registrar-approve`);
      setGrades((prev) =>
        prev.map((g) => (g.id === id ? { ...g, status: "approve" } : g))
      );
    } catch (err) {
      console.error("[/api/grades/final-grades/:id/registrar-approve] failed:", err);
    } finally {
      setApproving(null);
    }
  };

  const pending = grades.filter((g) => g.status === "pending").length;
  const approved = grades.filter((g) => g.status === "approve").length;

  const filtered = grades.filter((g) => {
    if (status !== "all" && g.status !== status) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const hay = `${g.name} ${g.lrn} ${g.section}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const statusValue =
    STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "All statuses";

  const pendingCount = filtered.filter((g) => g.status === "pending").length;

  const handleApproveAll = async () => {
    for (const g of filtered.filter((g) => g.status === "pending")) {
      await handleApprove(g.id);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const goToPage = (p: number) => {
    const next = Math.min(Math.max(p, 1), totalPages);
    setPage(next);
    setLoading(true);
    load(next);
  };

  // Reset to first page whenever the client-side status/search filter changes.
  const onStatusChange = (value: StatusFilter) => {
    setStatus(value);
    setPage(1);
    setLoading(true);
    load(1);
  };
  const onQueryChange = (value: string) => {
    setQuery(value);
    setPage(1);
    setLoading(true);
    load(1);
  };

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Final Grade Approvals</h1>
          <p className={styles.subtitle}>
            G11–12 locked finals awaiting registrar validation
          </p>
        </div>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      {loading ? (
        <div className={styles.skeletonWrap}>
          <div className={styles.skelSummary}>
            <Skeleton className={styles.skelKpi} />
            <Skeleton className={styles.skelKpi} />
            <Skeleton className={styles.skelKpi} />
          </div>

          <div className={styles.skelToolbar}>
            <Skeleton className={styles.skelSearch} />
            <div className={styles.skelToolbarRight}>
              <Skeleton className={styles.skelDropdown} />
              <Skeleton className={styles.skelBtn} />
              <Skeleton className={styles.skelCount} />
            </div>
          </div>

          <div className={styles.skelTable}>
            <div className={styles.skelTableHead}>
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className={styles.skelTh} />
              ))}
            </div>
            {Array.from({ length: 6 }).map((_, r) => (
              <div key={r} className={styles.skelRow}>
                {Array.from({ length: 10 }).map((_, c) => (
                  <Skeleton key={c} className={styles.skelTh} />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className={styles.summary}>
            <KpiThreadsCard label="Pending" value={pending} hint="Locked finals to validate" />
            <KpiThreadsCard label="Approved" value={approved} hint="Validated this session" />
            <KpiThreadsCard label="Total" value={total} hint="G11–12 locked final grades" />
          </div>

          <div className={styles.toolbar}>
            <div className={styles.search}>
              <SearchIcon className={styles.searchIcon} />
              <Input
                placeholder="Search by LRN, name, or section"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            <div className={styles.toolbarRight}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={styles.dropdown}>
                    <span className={styles.dropdownValue}>{statusValue}</span>
                    <ChevronDown className={styles.dropdownChevron} aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={styles.menu}>
                  {STATUS_OPTIONS.map((o) => (
                    <DropdownMenuItem
                      key={o.value}
                      className={styles.menuItem}
                      onSelect={() => onStatusChange(o.value)}
                    >
                      {o.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="default"
                size="sm"
                className={styles.approveAll}
                disabled={pendingCount === 0 || approving !== null}
                onClick={handleApproveAll}
              >
                {approving !== null ? "Approving…" : `Approve all (${pendingCount})`}
              </Button>

              <Badge variant="outline" className={styles.countBadge}>
                {filtered.length} shown
              </Badge>
            </div>
          </div>

          <FinalGradeApprovalTable
            rows={filtered}
            onApprove={handleApprove}
            approving={approving}
          />

          {totalPages > 1 ? (
            <div className={styles.pager}>
              <FinalGradesPagination page={page} pageCount={totalPages} onPageChange={goToPage} />
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
