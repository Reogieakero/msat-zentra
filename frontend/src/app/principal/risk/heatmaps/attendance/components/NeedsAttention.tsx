"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Search, TriangleAlert } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import common from "./heatmap-table.module.css";
import { SortTh } from "./heatmap-table";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./NeedsAttention.module.css";

interface AtRiskStudent {
  id: string;
  lrn: string;
  name: string;
  sectionId: string;
  section: string;
  gradeLevel: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  rate: number;
  hasAccount: boolean;
}

export function NeedsAttention({
  onInspectSection,
}: {
  onInspectSection: (sectionId: string, sectionName: string) => void;
}) {
  const [expandedGrade, setExpandedGrade] = React.useState<string | null>(null);
  const [query, setQuery] = usePersistentState<string>(
    "zentra.attendance.attention.search",
    ""
  );
  // Per-grade column sort (Student / Rate). Default display is worst-first
  // by rate, so the first click on Rate flips to best-first.
  const [gradeSort, setGradeSort] = React.useState<{
    grade: string;
    key: "name" | "rate";
    dir: "asc" | "desc";
  } | null>(null);

  const toggleGradeSort = (grade: string, key: "name" | "rate") => {
    setGradeSort((prev) => {
      if (prev?.grade === grade && prev.key === key)
        return { grade, key, dir: prev.dir === "asc" ? "desc" : "asc" };
      return { grade, key, dir: key === "name" ? "asc" : "desc" };
    });
  };

  const sortGradeStudents = (grade: string, list: AtRiskStudent[]) => {
    if (gradeSort?.grade !== grade) return list;
    const dir = gradeSort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) =>
      gradeSort.key === "name"
        ? dir * a.name.localeCompare(b.name)
        : dir * (a.rate - b.rate)
    );
  };
  const gradeSorted = (grade: string, key: "name" | "rate") =>
    gradeSort?.grade === grade && gradeSort.key === key
      ? (gradeSort.dir as "asc" | "desc")
      : false;

  const { data, isPending } = useQuery({
    queryKey: ["attendance-needs-attention"],
    queryFn: async () => {
      const res = await apiClient.get<{
        students: AtRiskStudent[];
        schoolDays: number;
        term?: { id: string; termNumber: number };
      }>("/api/attendance/at-risk-students");
      return res.data;
    },
    staleTime: 30_000,
  });

  // Grouped by grade, worst grade first (by lowest student rate). Clicking
  // a grade row expands its student list. Search filters across every grade;
  // while searching, all matching grades stay expanded.
  const allStudents = React.useMemo(() => data?.students ?? [], [data]);
  const searching = query.trim() !== "";
  const filteredStudents = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allStudents;
    return allStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.lrn.toLowerCase().includes(q) ||
        s.section.toLowerCase().includes(q)
    );
  }, [allStudents, query]);
  const gradeGroups = React.useMemo(() => {
    const map = new Map<string, AtRiskStudent[]>();
    for (const s of filteredStudents) {
      const arr = map.get(s.gradeLevel) ?? [];
      arr.push(s);
      map.set(s.gradeLevel, arr);
    }
    return [...map.entries()]
      .map(([grade, list]) => ({
        grade,
        students: list.sort((a, b) => a.rate - b.rate),
      }))
      .sort((a, b) => {
        const worst =
          (a.students[0]?.rate ?? 100) - (b.students[0]?.rate ?? 100);
        if (worst !== 0) return worst;
        return Number(a.grade) - Number(b.grade);
      });
  }, [filteredStudents]);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Needs Attention</CardTitle>
          <CardDescription>
            Students under 80% of current attendance.
          </CardDescription>
        </div>
        <CardAction className="flex items-center gap-2">
          <div className={common.searchWrap}>
            <Search className={common.searchIcon} aria-hidden />
            <Input
              className={common.search}
              style={{ height: "2rem" }}
              placeholder="Search name, LRN, or section…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search students needing attention"
            />
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
      {isPending ? (
        <>
          <Skeleton className={styles.skelRow} />
          <Skeleton className={styles.skelRow} />
          <Skeleton className={styles.skelRow} />
        </>
      ) : gradeGroups.length === 0 ? (
        <p className={styles.empty}>
          <TriangleAlert className={styles.emptyIcon} aria-hidden />
          {searching
            ? `No students match “${query}”.`
            : "No students under 80% — nothing needs attention."}
        </p>
      ) : (
        <>
          <p className={styles.resultCount} aria-live="polite">
            {filteredStudents.length} student
            {filteredStudents.length === 1 ? "" : "s"} below 80%
            {searching ? ` matching “${query}”` : ""}
          </p>
          <ul className={styles.grades}>
            {gradeGroups.map((g) => {
              const open = searching || expandedGrade === g.grade;
              const worst = g.students[0]?.rate ?? 100;
              return (
                <li key={g.grade} className={styles.grade}>
                  <span className={assign.glowClip} aria-hidden="true">
                    <span className={assign.cardGlow} />
                  </span>
                  <Badge variant="secondary" className={assign.gradeFloat}>
                    {g.students.length} student{g.students.length === 1 ? "" : "s"}
                  </Badge>
                  <button
                    type="button"
                    className={styles.gradeBtn}
                    onClick={() =>
                      setExpandedGrade(
                        expandedGrade === g.grade ? null : g.grade
                      )
                    }
                    aria-expanded={open}
                    aria-label={`Grade ${g.grade} — ${g.students.length} below 80%, worst ${worst}%`}
                  >
                    <span className={assign.avatar} aria-hidden="true">
                      G{g.grade}
                    </span>
                    <span className={assign.cardTitleBlock}>
                      <span className={assign.fieldLabel}>Grade</span>
                      <span className={styles.gradeName}>Grade {g.grade}</span>
                    </span>
                    <span className={assign.claimMark}>
                      <span
                        className={styles.dot}
                        data-sev={worst < 50 ? "bad" : "warn"}
                        aria-hidden
                      />
                      <span className={assign.claimLabel}>
                        <span className={styles.worstLabel}>
                          Worst {worst}%
                        </span>
                      </span>
                    </span>
                    {open ? (
                      <ChevronDown className={styles.chev} aria-hidden />
                    ) : (
                      <ChevronRight className={styles.chev} aria-hidden />
                    )}
                  </button>
                  <div
                    className={styles.expandable}
                    data-open={open ? true : undefined}
                  >
                    <div className={styles.tablePad}>
                      <div className={common.tableWrap}>
                        <Table aria-label={`Students below 80% in Grade ${g.grade}`}>
                          <TableHeader>
                            <TableRow>
                              <TableHead>
                                <SortTh
                                  label="Student"
                                  sorted={gradeSorted(g.grade, "name")}
                                  onToggle={() => toggleGradeSort(g.grade, "name")}
                                />
                              </TableHead>
                              <TableHead>Record</TableHead>
                              <TableHead>
                                <SortTh
                                  label="Rate"
                                  sorted={gradeSorted(g.grade, "rate")}
                                  onToggle={() => toggleGradeSort(g.grade, "rate")}
                                />
                              </TableHead>
                              <TableHead>
                                <span className="sr-only">Actions</span>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortGradeStudents(g.grade, g.students).map((s) => (
                              <TableRow key={s.id}>
                                <TableCell>
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span
                                      className={styles.dot}
                                      data-sev={s.rate < 50 ? "bad" : "warn"}
                                      aria-hidden
                                    />
                                    <div className="min-w-0">
                                      <p className={common.cellMain}>{s.name}</p>
                                      <p className={common.cellSub}>
                                        {s.lrn} · {s.section}
                                      </p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className={common.mono}>
                                    {s.present} pres · {s.late} late · {s.absent} abs ·{" "}
                                    {s.excused} exc
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={s.rate < 80 ? "destructive" : "outline"}
                                    className={common.rateBadge}
                                  >
                                    {s.rate}%
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      onInspectSection(s.sectionId, s.section)
                                    }
                                    aria-label={`Show section attendance for ${s.section}`}
                                  >
                                    Section
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
      </CardContent>
    </Card>
  );
}
