"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Search, MoreHorizontal, Eye, X } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { formatSection } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import styles from "./final-grades.module.css";
import { GradePipeline } from "./GradePipeline";

interface SubjectRow {
  id: string;
  subject: string;
  computedAverage: number;
  transmutedGrade: number;
  remarks: string;
  status: "approved";
}

interface StudentRow {
  id: string;
  lrn: string;
  name: string;
  gradeLevel: string;
  section: string;
  term: string;
  overall: number;
  subjects: SubjectRow[];
  status: "approved";
}

interface GradesResponse {
  students: StudentRow[];
  total: number;
  ready: number;
  complete: number;
  locked: number;
  adviserApproved: number;
  page: number;
  pageSize: number;
}
function Stat({
  value,
  label,
  hint,
}: {
  value: number | undefined;
  label: string;
  hint: string;
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{value ?? "—"}</span>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statHint}>{hint}</span>
    </div>
  );
}

export default function FinalGradeApprovalsPage() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);

  const { data, isPending } = useQuery({
    queryKey: ["registrar-final-grades"],
    queryFn: () =>
      apiClient
        .get<GradesResponse>("/api/registrar/final-grades", { params: { pageSize: 100 } })
        .then((res) => res.data),
  });

  const stats = {
    ready: data?.ready ?? 0,
    complete: data?.complete ?? 0,
    total: data?.total ?? 0,
  };

  const allStudents = React.useMemo(() => data?.students ?? [], [data]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return allStudents.filter((s) => {
      const matchesQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.lrn.toLowerCase().includes(q) ||
        s.section.toLowerCase().includes(q) ||
        s.subjects.some((sub) => sub.subject.toLowerCase().includes(q));
      return matchesQuery;
    });
  }, [allStudents, query]);

  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <section className={styles.page}>
      <div className={styles.statsRow}>
        {isPending ? (
          <>
            <Skeleton className={styles.statSkel} />
            <Skeleton className={styles.statSkel} />
            <Skeleton className={styles.statSkel} />
          </>
        ) : (
          <>
            <Stat
              value={stats.ready}
              label="Ready subjects"
              hint="Adviser-approved final grades, viewable"
            />
            <Stat
              value={stats.complete}
              label="Complete sets"
              hint="Students with a fully approved term"
            />
            <Stat value={stats.total} label="Total rows" hint="G11–12 grade entries" />
          </>
        )}
      </div>

      <hr className={styles.divider} />

      <GradePipeline
        counts={{
          locked: data?.locked,
          adviserApproved: data?.adviserApproved,
          complete: data?.complete,
        }}
        isLoading={isPending}
      />

      <hr className={styles.divider} />

      <div className={styles.listCard}>
        <div className={styles.listHead}>
          <div className={styles.listHeadText}>
            <h2 className={styles.listTitle}>Final Grade Approvals</h2>
            <p className={styles.listDesc}>
              One row per student with a complete term — every subject adviser-approved.
            </p>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.searchWrap}>
              <Search className={styles.searchIcon} aria-hidden />
              <Input
                className={styles.search}
                placeholder="Search name, LRN, or subject…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                aria-label="Search final grades"
              />
            </div>

            {query && (
              <Button
                variant="ghost"
                size="sm"
                className={styles.clearBtn}
                onClick={() => {
                  setQuery("");
                  setPage(1);
                }}
              >
                <X aria-hidden />
                Clear
              </Button>
            )}
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Student</th>
              <th>Section</th>
              <th>Term</th>
              <th className={styles.centerCell}>Overall Avg</th>
              <th>Status</th>
              <th className={styles.thAction} />
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <SkeletonRows />
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  {query.trim()
                    ? `No complete grade sets match "${query}".`
                    : "No complete grade sets yet. Students appear once every subject is adviser-approved."}
                </td>
              </tr>
            ) : (
              pageRows.map((s) => (
                <tr key={s.id} className={styles.tableRow}>
                  <td>
                    <div className={styles.studentCell}>
                      <span className={styles.studentName}>{s.name}</span>
                      <span className={styles.studentLrn}>{s.lrn}</span>
                    </div>
                  </td>
                  <td className={styles.cell}>{formatSection(s.section)}</td>
                  <td className={styles.cell}>{s.term}</td>
                  <td className={`${styles.mono} ${styles.leftCell}`}>{s.overall}</td>
                  <td>
                    <Badge variant="default" className={styles.statusBadge}>
                      Complete
                    </Badge>
                  </td>
                  <td className={styles.actionCell}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/registrar/final-grades/${s.id}`)}>
                          <Eye aria-hidden />
                          View grade details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled>Registrar approval is not required</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className={styles.footer}>
          <span className={styles.footerInfo}>
            {filtered.length > 0 ? `${start}–${end} of ${filtered.length}` : "0 of 0"}
          </span>
          <div className={styles.footerActions}>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage <= 1 || filtered.length === 0}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages || filtered.length === 0}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <hr className={styles.divider} />
    </section>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i}>
          <td>
            <div className={styles.studentCell}>
              <Skeleton className={styles.skelName} />
              <Skeleton className={styles.skelLrn} />
            </div>
          </td>
          <td>
            <Skeleton className={styles.skelCell} style={{ width: "60%" }} />
          </td>
          <td>
            <Skeleton className={styles.skelCell} style={{ width: "50%" }} />
          </td>
          <td>
            <Skeleton className={styles.skelCell} style={{ width: "50%" }} />
          </td>
          <td>
            <Skeleton className={styles.skelCell} style={{ width: "50%" }} />
          </td>
          <td />
        </tr>
      ))}
    </>
  );
}