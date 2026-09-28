"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Check, Search, X, BarChart3 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useGradeMode } from "../../grade-mode-context";
import { RiskBadge } from "./RiskBadge";
import { GradeBreakdownDrawer } from "./GradeBreakdownDrawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AcademicsMock, StudentRow } from "../academics-data";
import styles from "./StudentsAcademicsGrid.module.css";

export function StudentsAcademicsGrid() {
  const { gradeMode } = useGradeMode();
  const [grade, setGrade] = React.useState<string>("all");
  const [sectionId, setSectionId] = React.useState<string>("all");
  const [query, setQuery] = React.useState("");
  const [detailStudent, setDetailStudent] = React.useState<StudentRow | null>(null);

  const {
    data,
    isPending,
    error: queryError,
  } = useQuery({
    queryKey: ["academics", gradeMode],
    queryFn: async () =>
      (await apiClient.get<AcademicsMock>("/api/academics", { params: { mode: gradeMode } })).data,
  });

  const sections = React.useMemo(() => data?.sections ?? [], [data]);

  const loading = isPending;

  const error = React.useMemo(() => {
    if (!queryError) return null;
    const status = (queryError as { response?: { status?: number } })?.response?.status;
    return status
      ? `Failed to load student grades (HTTP ${status})`
      : "Failed to load student grades";
  }, [queryError]);

  const grades = React.useMemo(
    () => Array.from(new Set(sections.map((s) => s.grade))).sort(byGrade),
    [sections]
  );

  const gradeSections = React.useMemo(
    () => (grade === "all" ? sections : sections.filter((s) => s.grade === grade)),
    [sections, grade]
  );

  const selectedSections = React.useMemo(
    () => (sectionId === "all" ? gradeSections : gradeSections.filter((s) => s.sectionId === sectionId)),
    [gradeSections, sectionId]
  );

  const listedStudents = React.useMemo(
    () =>
      selectedSections.flatMap((s) =>
        s.students.map((st) => ({ ...st, sectionName: s.section }))
      ),
    [selectedSections]
  );

  const filteredStudents = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return listedStudents;
    return listedStudents.filter(
      (st) => st.name.toLowerCase().includes(q) || st.lrn.toLowerCase().includes(q)
    );
  }, [listedStudents, query]);

  const sectionLabel = React.useMemo(
    () => gradeSections.find((s) => s.sectionId === sectionId)?.section ?? "All sections",
    [gradeSections, sectionId]
  );

  const handleGradeChange = (value: string) => {
    setGrade(value);
    setSectionId("all");
  };

  const activeName = query.trim().toLowerCase();

  const handleStudentPick = (name: string) => {
    setQuery((prev) => (prev.trim().toLowerCase() === name.toLowerCase() ? "" : name));
  };

  return (
    <section className={styles.section}>
      <div className={styles.body}>
        <div className={styles.layout}>
          <aside className={styles.sidebar} aria-label="Find a student">
            <div className={styles.sideSearch}>
              <Search className={styles.searchIcon} aria-hidden />
              <input
                className={styles.search}
                placeholder="Search by name or LRN"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search students"
              />
              {query ? (
                <button
                  type="button"
                  className={styles.clearBtn}
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  <X className={styles.clearIcon} aria-hidden />
                </button>
              ) : null}
            </div>

            <div className={styles.sideFilters}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={styles.dropdown}>
                    <span>{grade === "all" ? "All grades" : grade}</span>
                    <ChevronDown className={styles.dropdownIcon} aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className={styles.dropdownMenu}>
                  <DropdownMenuItem
                    className={styles.dropdownItem}
                    onSelect={() => handleGradeChange("all")}
                  >
                    <span>All grades</span>
                    {grade === "all" ? <Check className={styles.dropdownCheck} /> : null}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {grades.map((g) => (
                    <DropdownMenuItem
                      key={g}
                      className={styles.dropdownItem}
                      onSelect={() => handleGradeChange(g)}
                    >
                      <span>{g}</span>
                      {grade === g ? <Check className={styles.dropdownCheck} /> : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={styles.dropdown}>
                    <span>{sectionId === "all" ? "All sections" : sectionLabel}</span>
                    <ChevronDown className={styles.dropdownIcon} aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className={styles.dropdownMenu}>
                  <DropdownMenuItem
                    className={styles.dropdownItem}
                    onSelect={() => setSectionId("all")}
                  >
                    <span>All sections</span>
                    {sectionId === "all" ? <Check className={styles.dropdownCheck} /> : null}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {gradeSections.map((s) => (
                    <DropdownMenuItem
                      key={s.sectionId}
                      className={styles.dropdownItem}
                      onSelect={() => setSectionId(s.sectionId)}
                    >
                      <span>{s.section}</span>
                      {sectionId === s.sectionId ? <Check className={styles.dropdownCheck} /> : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <p className={styles.listHeading}>
              Students
              <span className={styles.listCount}>{filteredStudents.length}</span>
            </p>
            <p className={styles.listHint}>
              Click a name to isolate their card; click again to show all.
            </p>
            {loading && sections.length === 0 ? (
              <p className={styles.listEmpty}>Loading students…</p>
            ) : filteredStudents.length === 0 ? (
              <p className={styles.listEmpty}>No students match.</p>
            ) : (
              <ul className={styles.studentList}>
                {filteredStudents.map((st) => {
                  const isActive = activeName === st.name.toLowerCase() && activeName !== "";
                  return (
                    <li key={st.studentId}>
                      <button
                        type="button"
                        className={`${styles.studentRow} ${isActive ? styles.studentRowActive : ""}`}
                        onClick={() => handleStudentPick(st.name)}
                        aria-pressed={isActive}
                        title={isActive ? "Show all students" : `Show only ${st.name} — ${st.sectionName}`}
                      >
                        <span className={styles.studentName}>{st.name}</span>
                        <span className={styles.studentMeta}>
                          <span className={styles.studentLrn}>{st.lrn}</span>
                          <span className={styles.studentSection}>{st.sectionName}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          <div className={styles.main}>
            <Card className={styles.panel}>
              <CardHeader className={styles.panelHeader}>
                <div className={styles.panelHeaderText}>
                  <CardTitle>Student Academic Reports</CardTitle>
                </div>
                <CardAction>
                  <Badge
                    variant="secondary"
                    className={styles.countBadge}
                    role="status"
                    title={
                      grade !== "all" || sectionId !== "all"
                        ? `Filtered by ${grade !== "all" ? grade : "all grades"}, ${sectionId !== "all" ? sectionLabel : "all sections"}`
                        : "Showing all grades and sections"
                    }
                  >
                    Showing {filteredStudents.length} of {listedStudents.length}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className={styles.panelContent}>
            {error ? (
              <p className={styles.error}>{error}</p>
            ) : loading && sections.length === 0 ? (
              <div className={styles.grid} aria-hidden>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className={`${styles.card} ${styles.skeletonCard}`} />
                ))}
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className={styles.emptyWrap}>
                <p className={styles.empty}>
                  {query.trim()
                    ? `No students match “${query.trim()}”.`
                    : "No student academic records available."}
                </p>
                {query.trim() ? (
                  <button
                    type="button"
                    className={styles.emptyClear}
                    onClick={() => {
                      setQuery("");
                      setGrade("all");
                      setSectionId("all");
                    }}
                  >
                    Clear search and filters
                  </button>
                ) : null}
              </div>
            ) : (
              <div className={styles.grid}>
                {filteredStudents.map((student) => {
                  const graded = student.subjects.length > 0;
                  return (
                  <article key={student.studentId} className={styles.card}>
                    <div className={styles.cardHead}>
                      <span className={styles.avatar} aria-hidden>
                        {initials(student.name)}
                      </span>
                      <span className={styles.headText}>
                        <h4 className={styles.name} title={student.name}>
                          {student.name}
                        </h4>
                        <p className={styles.lrn}>
                          {student.lrn} · {student.sectionName}
                        </p>
                      </span>
                      <RiskBadge level={student.riskLevel} />
                    </div>
                    <div className={styles.stats}>
                      <div className={styles.stat}>
                        <span className={styles.statValue}>
                          {graded ? student.overallAverage : "—"}
                        </span>
                        <span className={styles.statLabel}>Average</span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.statValue}>
                          {student.attendanceRatePct}%
                        </span>
                        <span className={styles.statLabel}>Attendance</span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.statValue}>
                          {student.subjects.length}
                        </span>
                        <span className={styles.statLabel}>Subjects</span>
                      </div>
                    </div>
                    {graded ? (
                      <button
                        type="button"
                        className={styles.detailBtn}
                        onClick={() => setDetailStudent(student)}
                        aria-label={`See all subject grades for ${student.name}`}
                      >
                        <BarChart3 className={styles.detailBtnIcon} aria-hidden />
                        See subject grades
                      </button>
                    ) : (
                      <p className={styles.noGrades}>No grades encoded yet.</p>
                    )}
                  </article>
                  );
                })}
              </div>
            )}
              </CardContent>
            </Card>
          </div>
        </div>

        {loading && (
          <div className={styles.overlay} role="status" aria-label="Loading grades">
            <span className={styles.spinner} aria-hidden />
          </div>
        )}

        <GradeBreakdownDrawer
          student={detailStudent}
          gradeMode={gradeMode}
          open={detailStudent !== null}
          onOpenChange={(open) => {
            if (!open) setDetailStudent(null);
          }}
        />
      </div>
    </section>
  );
}

function byGrade(a: string, b: string): number {
  return Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, ""));
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
