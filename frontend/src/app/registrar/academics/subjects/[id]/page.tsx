"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { fetchSubjectStudents, type SubjectStudent } from "../../api";
import styles from "./subject-students.module.css";

const PAGE_SIZE = 30;

export default function SubjectStudentsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [subject, setSubject] = React.useState<{ code: string; name: string; gradeLevel: number } | null>(null);
  const [students, setStudents] = React.useState<SubjectStudent[]>([]);
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    const ctrl = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch populates state
    setLoading(true);
    setError(null);
    fetchSubjectStudents(id, ctrl.signal)
      .then((res) => {
        setSubject(res.subject);
        setStudents(res.students);
      })
      .catch((err) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        setError(status === 404 ? "Subject not found" : "Failed to load students");
        console.error("[/api/registrar/academics/subjects/:id/students] failed:", err);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [id]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset to first page on new search
    setPage(1);
  }, [query]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => `${s.lrn} ${s.name}`.toLowerCase().includes(q));
  }, [students, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <section className={styles.page}>
      <Link href="/registrar/academics" className={styles.back}>
        <ArrowLeft className={styles.backIcon} />
        Back to Sections &amp; Subjects
      </Link>

      <header className={styles.header}>
        <div className={styles.headText}>
          <h1 className={styles.title}>
            {subject ? `Grade ${subject.gradeLevel} · ${subject.name} (${subject.code})` : "Subject"}
          </h1>
          <p className={styles.subtitle}>
            {subject ? "Students enrolled in this subject" : "Loading subject…"}
          </p>
        </div>
      </header>

      {error ? (
        <p className={styles.empty}>{error}</p>
      ) : (
        <>
          <div className={styles.search}>
            <Search className={styles.searchIcon} aria-hidden />
            <Input
              className={styles.searchInput}
              placeholder="Search by LRN or name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {loading ? (
            <div className={styles.card}>
              <div className={styles.tableWrap}>
                <Table>
                  <TableHeader>
                    <TableRow className={styles.headRow}>
                      <TableHead>LRN</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Final Grade</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={6}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className={styles.card}>
              <div className={styles.tableWrap}>
                <Table>
                  <TableHeader>
                    <TableRow className={styles.headRow}>
                      <TableHead>LRN</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Final Grade</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((st) => (
                      <TableRow key={st.id}>
                        <TableCell className={`${styles.lrn} ${styles.green}`}>{st.lrn}</TableCell>
                        <TableCell className={styles.name}>{st.name}</TableCell>
                        <TableCell className={styles.muted}>{st.section}</TableCell>
                        <TableCell className={`${styles.grade} ${styles.green}`}>{st.finalGrade}</TableCell>
                        <TableCell>
                          {st.remarks === "Passed" ? (
                            <Badge variant="secondary">Passed</Badge>
                          ) : st.remarks === "Failed" ? (
                            <Badge variant="destructive">Failed</Badge>
                          ) : (
                            <Badge variant="outline">No grade yet</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {st.status === "active" ? (
                            <Badge variant="outline">Active</Badge>
                          ) : st.status === "pending" ? (
                            <Badge variant="warning">Pending</Badge>
                          ) : (
                            <Badge variant="outline">Suspended</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filtered.length === 0 ? (
                <p className={styles.empty}>No students match your search.</p>
              ) : (
                <div className={styles.paginationWrap}>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setPage((p) => Math.max(1, p - 1));
                          }}
                          aria-disabled={safePage <= 1}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <PaginationItem key={p}>
                          <PaginationLink
                            href="#"
                            isActive={p === safePage}
                            onClick={(e) => {
                              e.preventDefault();
                              setPage(p);
                            }}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setPage((p) => Math.min(totalPages, p + 1));
                          }}
                          aria-disabled={safePage >= totalPages}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
