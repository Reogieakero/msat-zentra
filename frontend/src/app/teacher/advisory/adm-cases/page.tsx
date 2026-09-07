"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { writeLastViewedReferralId } from "../referrals/last-viewed";
import { AdmCasesHeader } from "./components/AdmCasesHeader";
import { AdmCaseCard } from "./components/AdmCaseCard";
import { AdmCaseDialog } from "./components/AdmCaseDialog";
import { fetchMyAdmCases, type AdmCase } from "./components/adm-cases-data";
import styles from "./components/adm-cases.module.css";

type StatusFilter = "all" | "pending" | "approved";

const PAGE_SIZE = 50;

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
];

/**
 * Teacher ADM cases: every ADM case for the teacher's advisory students
 * (pending or principal-approved), one profile card per case. Read-only —
 * stage and status only, never confidential detail.
 */
export default function TeacherAdvisoryAdmCasesPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [detailCase, setDetailCase] = useState<AdmCase | null>(null);

  const casesQuery = useQuery({
    queryKey: ["adm-my-cases"],
    queryFn: fetchMyAdmCases,
    retry: false,
  });
  const cases = useMemo(() => casesQuery.data ?? [], [casesQuery.data]);

  const pendingCount = cases.filter((c) => !c.approved).length;
  const approvedCount = cases.filter((c) => c.approved).length;

  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      cases.filter((c) => {
        if (filter === "pending" && c.approved) return false;
        if (filter === "approved" && !c.approved) return false;
        if (!needle) return true;
        return (
          c.studentName.toLowerCase().includes(needle) ||
          c.lrn.toLowerCase().includes(needle)
        );
      }),
    [cases, filter, needle]
  );

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = visible.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, visible.length);

  function handleTrack(caseData: AdmCase) {
    // Deep-link into the referrals workflow canvas on this case's referral.
    writeLastViewedReferralId(caseData.referralId);
    setDetailCase(null);
    router.push("/teacher/advisory/referrals");
  }

  return (
    <section className={styles.page}>
      <AdmCasesHeader pending={casesQuery.isPending ? 0 : pendingCount} approved={casesQuery.isPending ? 0 : approvedCount} />
      <hr className={styles.divider} />

      <div className={styles.body}>
        <div className={styles.toolbar}>
          <div className={styles.filters} role="group" aria-label="Filter by approval status">
            {FILTERS.map((f) => {
              const count =
                f.key === "all" ? cases.length : f.key === "pending" ? pendingCount : approvedCount;
              const active = filter === f.key;
              return (
                <Button
                  key={f.key}
                  type="button"
                  variant={active ? "default" : "outline"}
                  size="sm"
                  aria-pressed={active}
                  onClick={() => {
                    setFilter(f.key);
                    setPage(1);
                  }}
                >
                  {f.label}
                  <Badge variant="secondary">{casesQuery.isPending ? "—" : count}</Badge>
                </Button>
              );
            })}
          </div>
          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} aria-hidden />
            <Input
              className={styles.search}
              placeholder="Search student or LRN…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              aria-label="Search ADM cases"
            />
          </div>
        </div>

        {casesQuery.isPending ? (
          <div className={styles.grid} aria-busy="true" aria-label="Loading ADM cases">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.skelCard} aria-hidden>
                <div className={styles.skelTop}>
                  <Skeleton className={styles.skelMini} />
                  <div className={styles.skelLines}>
                    <Skeleton className={styles.skelLine} />
                    <Skeleton className={styles.skelLineShort} />
                  </div>
                  <Skeleton className={styles.skelDot} />
                </div>
                <Skeleton className={styles.skelAvatar} />
                <Skeleton className={styles.skelName} />
                <Skeleton className={styles.skelSub} />
                <Skeleton className={styles.skelBar} />
                <div className={styles.skelActions}>
                  <Skeleton className={styles.skelBtn} />
                  <Skeleton className={styles.skelBtn} />
                </div>
              </div>
            ))}
          </div>
        ) : casesQuery.isError ? (
          <p className={styles.pageError}>
            No advisory section assigned, or the cases could not be loaded. Contact the
            school office.
          </p>
        ) : cases.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No ADM cases yet</p>
            <p className={styles.emptyBody}>
              None of your advisees are in the ADM pipeline. Cases appear here once an
              ADM referral moves forward.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No matches</p>
            <p className={styles.emptyBody}>
              {needle
                ? `No ADM cases match "${query.trim()}".`
                : "No ADM cases match the selected filter."}
            </p>
          </div>
        ) : (
          <>
            <div className={styles.grid}>
              {pageRows.map((c) => (
                <AdmCaseCard
                  key={c.id}
                  caseData={c}
                  onDetails={() => setDetailCase(c)}
                  onTrack={() => handleTrack(c)}
                />
              ))}
            </div>
            <div className={styles.footer}>
              <span className={styles.footerInfo}>
                {visible.length > 0 ? `${start}–${end} of ${visible.length}` : "0 of 0"}
              </span>
              <div className={styles.footerActions}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1 || visible.length === 0}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft aria-hidden />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages || visible.length === 0}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight aria-hidden />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <AdmCaseDialog
        caseData={detailCase}
        onClose={() => setDetailCase(null)}
        onTrack={handleTrack}
      />
    </section>
  );
}
