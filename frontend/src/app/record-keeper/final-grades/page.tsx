"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Search, MoreHorizontal, Eye, X, GraduationCap, SearchX } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { formatSection } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
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

export default function FinalGradeApprovalsPage() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);

  const { data, isPending, isError } = useQuery({
    queryKey: ["record-keeper-final-grades"],
    queryFn: () =>
      apiClient
        .get<GradesResponse>("/api/record-keeper/final-grades", { params: { pageSize: 100 } })
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
  const hasRecords = allStudents.length > 0;
  const searching = query.trim().length > 0;

  return (
    <section className={styles.page}>
      <div className={styles.stack}>
        <GradePipeline
          counts={{
            locked: data?.locked,
            adviserApproved: data?.adviserApproved,
            complete: data?.complete,
          }}
          isLoading={isPending}
          orientation="horizontal"
        />

        <section className={assign.card} aria-label="Final grades summary">
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          {isPending ? (
            <ul className={`${styles.tiles} relative`}>
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i}>
                  <Skeleton className={styles.tileSkel} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className={`${styles.tiles} relative`}>
              <li className={styles.tile}>
                <span className={styles.tileValue}>{stats.ready}</span>
                <span className={styles.tileLabel}>Ready subjects</span>
                <span className={styles.tileHint}>Adviser-approved final grades, viewable</span>
              </li>
              <li className={styles.tile}>
                <span className={styles.tileValue}>{stats.complete}</span>
                <span className={styles.tileLabel}>Complete sets</span>
                <span className={styles.tileHint}>Students with a fully approved term</span>
              </li>
              <li className={styles.tile}>
                <span className={styles.tileValue}>{stats.total}</span>
                <span className={styles.tileLabel}>Total students</span>
                <span className={styles.tileHint}>Fully approved student-terms in G7–10</span>
              </li>
            </ul>
          )}
        </section>

        <section className={assign.card} aria-labelledby="finals-table-heading">
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className={`${styles.listHead} relative`}>
            <div className={styles.listHeadText}>
              <h2 id="finals-table-heading" className="text-base font-semibold">
                Final Grade Approvals
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
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

          <div className={`${styles.content} relative`}>
            {isPending ? (
              <div className={styles.tableWrap}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Overall Avg</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <SkeletonRows />
                  </TableBody>
                </Table>
              </div>
            ) : isError ? (
              <p className={styles.empty}>Could not load final grades.</p>
            ) : !hasRecords ? (
              <div className={styles.emptyBlock}>
                <span className={styles.emptyIcon} aria-hidden>
                  <GraduationCap />
                </span>
                <p className={styles.emptyTitle}>No complete grade sets yet</p>
                <p className={styles.emptyHint}>
                  Students appear once every subject is adviser-approved.
                </p>
              </div>
            ) : searching && filtered.length === 0 ? (
              <div className={styles.emptyBlock}>
                <span className={styles.emptyIcon} aria-hidden>
                  <SearchX />
                </span>
                <p className={styles.emptyTitle}>No matching grade sets</p>
                <p className={styles.emptyHint}>
                  {`No complete grade sets match "${query}".`}
                </p>
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Overall Avg</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className={styles.studentCell}>
                            <span className={styles.studentName}>{s.name}</span>
                            <span className={styles.studentLrn}>{s.lrn}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={styles.sectionText}>{formatSection(s.section)}</span>
                        </TableCell>
                        <TableCell className={styles.cellMuted}>{s.term}</TableCell>
                        <TableCell>
                          <span className={styles.gradeTag}>{s.overall}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default" className={styles.statusBadge}>
                            Complete
                          </Badge>
                        </TableCell>
                        <TableCell className={styles.menuCell}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${s.name}`}>
                                <MoreHorizontal aria-hidden />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => router.push(`/record-keeper/final-grades/${s.id}`)}>
                                <Eye aria-hidden />
                                View grade details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem disabled>Registrar approval is not required</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {hasRecords && (
            <div className={`${styles.footer} relative`}>
              <p className={styles.footerInfo}>
                Showing {filtered.length > 0 ? `${start}–${end}` : "0"} of {filtered.length}
              </p>
              <div className={styles.footerActions}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={safePage <= 1 || filtered.length === 0}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className={styles.pageLabel} aria-live="polite">
                  Page {safePage} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={safePage >= totalPages || filtered.length === 0}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <div className={styles.studentCell}>
              <Skeleton className={styles.skelName} />
              <Skeleton className={styles.skelLrn} />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className={styles.skelCell} style={{ width: "60%" }} />
          </TableCell>
          <TableCell>
            <Skeleton className={styles.skelCell} style={{ width: "50%" }} />
          </TableCell>
          <TableCell>
            <Skeleton className={styles.skelCell} style={{ width: "50%" }} />
          </TableCell>
          <TableCell>
            <Skeleton className={styles.skelCell} style={{ width: "50%" }} />
          </TableCell>
          <TableCell />
        </TableRow>
      ))}
    </>
  );
}
