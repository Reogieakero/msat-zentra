"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Check, Search, ExternalLink } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useGradeMode } from "../../grade-mode-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AcademicsMock } from "../academics-data";
import styles from "./StudentsAcademicsGrid.module.css";

export function StudentsAcademicsGrid() {
  const { gradeMode } = useGradeMode();
  const [grade, setGrade] = React.useState<string>("all");
  const [sectionId, setSectionId] = React.useState<string>("all");
  const [query, setQuery] = React.useState("");

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

  const students = React.useMemo(
    () => selectedSections.flatMap((s) => s.students),
    [selectedSections]
  );

  const filteredStudents = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (st) => st.name.toLowerCase().includes(q) || st.lrn.toLowerCase().includes(q)
    );
  }, [students, query]);

  const sectionLabel = React.useMemo(
    () => gradeSections.find((s) => s.sectionId === sectionId)?.section ?? "All sections",
    [gradeSections, sectionId]
  );

  const handleGradeChange = (value: string) => {
    setGrade(value);
    setSectionId("all");
  };

  return (
    <section className={styles.section}>
      <div className={styles.body}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <Search className={styles.searchIcon} aria-hidden />
          <input
            className={styles.search}
            placeholder="Search by name or LRN"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search students"
          />
        </div>
        <div className={styles.toolbarRight}>
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
      </div>

      {error ? (
        <p className={styles.error}>{error}</p>
      ) : loading && sections.length === 0 ? (
        <div className={styles.grid} aria-hidden>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`${styles.card} ${styles.skeletonCard}`} />
          ))}
        </div>
      ) : filteredStudents.length === 0 ? (
        <p className={styles.empty}>
          {query.trim() ? "No students match your search." : "No student academic records available."}
        </p>
      ) : (
        <div className={styles.grid}>
          {filteredStudents.map((student) => (
            <article key={student.studentId} className={styles.card}>
              <button
                type="button"
                className={styles.viewBtn}
                aria-label={`View ${student.name}`}
                title="View details"
              >
                <ExternalLink className={styles.viewIcon} aria-hidden />
              </button>
              <h4 className={styles.name}>{student.name}</h4>
              <p className={styles.lrn}>{student.lrn}</p>
              <hr className={styles.cardDivider} />
              <TooltipProvider delayDuration={100}>
                <div className={styles.bars}>
                  {student.subjects.map((sub) => (
                    <Tooltip key={sub.subject}>
                      <TooltipTrigger asChild>
                        <span className={styles.barCol}>
                          <span className={styles.barTrack}>
                            <span
                              className={`${styles.barFill} ${
                                sub.transmutedGrade < 75 ? styles.barFillFail : ""
                              }`}
                              style={{ height: `${sub.transmutedGrade}%` }}
                            />
                          </span>
                          <span className={styles.barLabel}>{shortLabel(sub.subject)}</span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <span className={styles.tooltipLine}>
                          <span>{sub.subject}</span>
                          <span>Grade: {sub.transmutedGrade}</span>
                        </span>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            </article>
          ))}
        </div>
      )}

      {loading && (
        <div className={styles.overlay} role="status" aria-label="Loading grades">
          <span className={styles.spinner} aria-hidden />
        </div>
      )}
      </div>
    </section>
  );
}

function byGrade(a: string, b: string): number {
  return Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, ""));
}

function shortLabel(subject: string): string {
  const map: Record<string, string> = {
    English: "Eng",
    Mathematics: "Math",
    Science: "Sci",
    Filipino: "Fil",
    "Araling Panlipunan": "AP",
    "Edukasyon sa Pagpapakatao": "ESP",
    Technology: "TLE",
    MAPEH: "MAP",
    ICT: "ICT",
    TLE: "TLE",
  };
  return map[subject] ?? subject.slice(0, 3);
}
