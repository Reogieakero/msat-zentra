"use client";

import * as React from "react";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { ChevronDown, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SubjectGradesSkeleton } from "./advisory-students-skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  classDetailKey,
  fetchClassDetail,
  type ClassDetail,
  type ClassStudent,
} from "../../../grading/components/grading-data";
import { useSession } from "@/lib/auth/useSession";
import { StudentGradesSheet } from "./StudentGradesSheet";
import styles from "./SubjectStudents.module.css";

type SubjectRisk = "Low" | "Moderate" | "High";

const RISK_VARIANTS = {
  Low: "outline",
  Moderate: "warning",
  High: "destructive",
} as const;

// Grade-based early warning for one subject, mirroring the DepEd 75
// passing mark the backend risk engine uses: failing is High, the
// 75–84 borderline band is Moderate, 85+ is Low.
function subjectRisk(transmuted: number | null | undefined): SubjectRisk | null {
  if (transmuted == null) return null;
  if (transmuted < 75) return "High";
  if (transmuted < 85) return "Moderate";
  return "Low";
}

export interface SubjectGradebookTarget {
  id: string;
  section: string;
}

interface SubjectStudentsProps {
  subject: string;
  targets: SubjectGradebookTarget[];
}

export function SubjectStudents({ subject, targets }: SubjectStudentsProps) {
  const session = useSession();
  const teacherId = session?.sub ?? null;
  const assignmentIds = targets.map((t) => t.id);
  const sections = [...new Set(targets.map((t) => t.section))];
  // Teacher-scoped keys shared with the class workspace — opening a
  // workspace after viewing its subject reuses cached detail.
  const details = useQueries({
    queries: assignmentIds.map((id) => ({
      queryKey: classDetailKey(teacherId, id),
      queryFn: () => fetchClassDetail(id),
      enabled: !!teacherId,
      retry: false,
      staleTime: 15_000,
    })),
  });

  const [query, setQuery] = React.useState("");
  const [activeStudentId, setActiveStudentId] = React.useState<string | null>(null);

  // Fresh subject selection starts clean — no stale search or open sheet.
  // (Render-phase reset: allowed because it is conditional on prop change.)
  const [resetSubject, setResetSubject] = React.useState(subject);
  if (resetSubject !== subject) {
    setResetSubject(subject);
    setQuery("");
    setActiveStudentId(null);
  }

  const pending = details.some((d) => d.isPending);
  const failed = details.some((d) => d.isError);

  const students: ClassStudent[] = React.useMemo(() => {
    const seen = new Map<string, ClassStudent>();
    for (const d of details) {
      for (const s of d.data?.students ?? []) {
        if (!seen.has(s.id)) seen.set(s.id, s);
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [details]);

  const needle = query.trim().toLowerCase();
  const filtered = needle === ""
    ? students
    : students.filter(
        (s) => s.name.toLowerCase().includes(needle) || s.lrn.includes(needle)
      );

  const activeStudent = activeStudentId == null
    ? null
    : students.find((s) => s.id === activeStudentId) ?? null;
  const loadedDetails = details
    .map((d) => d.data)
    .filter((d): d is ClassDetail => d != null);

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.metaLine}>
            <span className={styles.metaRow}>
              <span className={styles.metaLabel}>Subject</span>
              <span className={styles.metaValue}>{subject}</span>
            </span>
            <span className={styles.metaRow}>
              <span className={styles.metaLabel}>
                Section{sections.length === 1 ? "" : "s"}
              </span>
              <span className={styles.metaValue}>{sections.join(", ")}</span>
            </span>
          </h2>
        </div>
        <CardAction className={styles.headerActions}>
          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} aria-hidden />
            <Input
              className={styles.search}
              placeholder="Search name or LRN…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={`Search students in ${subject}`}
            />
          </div>
          {targets.length === 1 ? (
            <Button variant="outline" size="sm" className={styles.openGradebookBtn} asChild>
              <Link href={`/teacher/grading/${targets[0].id}`}>Open gradebook</Link>
            </Button>
          ) : targets.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={styles.openGradebookBtn}>
                  Open gradebook
                  <ChevronDown aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {targets.map((t) => (
                  <DropdownMenuItem key={t.id} asChild>
                    <Link href={`/teacher/grading/${t.id}`}>{t.section}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </CardAction>
      </CardHeader>

      <CardContent className={styles.content}>
        {pending ? (
          <SubjectGradesSkeleton />
        ) : failed || assignmentIds.length === 0 ? (
          <p className={styles.empty}>
            Could not load grades for this subject. Check your connection and try again.
          </p>
        ) : filtered.length === 0 ? (
          <p className={styles.empty}>
            {students.length === 0
              ? "No students in this subject yet."
              : `No students match "${query}".`}
          </p>
        ) : (
          <Table aria-label={`${subject} grades`}>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>LRN</TableHead>
                <TableHead>Computed</TableHead>
                <TableHead>Transmuted</TableHead>
                <TableHead className={styles.riskCell}>Academic Risk</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const f = s.final;
                const risk = subjectRisk(f?.transmutedGrade);
                return (
                  <TableRow
                    key={s.id}
                    className={styles.clickableRow}
                    onClick={() => setActiveStudentId(s.id)}
                  >
                    <TableCell>
                      <p className={styles.cellMain}>{s.name}</p>
                    </TableCell>
                    <TableCell className={styles.lrn}>{s.lrn}</TableCell>
                    <TableCell className={styles.num}>
                      {f?.computedAverage != null ? f.computedAverage.toFixed(2) : "—"}
                    </TableCell>
                    <TableCell className={styles.num}>
                      {f?.transmutedGrade != null ? f.transmutedGrade.toFixed(0) : "—"}
                    </TableCell>
                    <TableCell className={styles.riskCell}>
                      {risk == null ? (
                        "—"
                      ) : (
                        <Badge variant={RISK_VARIANTS[risk]}>{risk}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{f?.remarks ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {activeStudent != null ? (
        <StudentGradesSheet
          student={activeStudent}
          details={loadedDetails}
          onClose={() => setActiveStudentId(null)}
        />
      ) : null}
    </Card>
  );
}
