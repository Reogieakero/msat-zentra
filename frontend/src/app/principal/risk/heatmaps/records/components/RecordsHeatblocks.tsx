"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, CircleDot, ChevronDown, Check } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import styles from "./RecordsHeatblocks.module.css";
import {
  CATEGORY_META,
  CATEGORY_KEYS,
  categoryColor,
  fetchRecords,
} from "./records-data";

export function RecordsHeatblocks({
  selectedLrn,
  onSelectLrn,
  selectedGrade,
  onSelectGrade,
}: {
  selectedLrn: string | null;
  onSelectLrn: (lrn: string | null) => void;
  selectedGrade: string | null;
  onSelectGrade: (grade: string | null) => void;
}) {
  const [query, setQuery] = React.useState("");

  const { data, isPending, isError } = useQuery({
    queryKey: ["records-heatmap"],
    queryFn: fetchRecords,
  });

  const sections = React.useMemo(() => data?.sections ?? [], [data]);

  const grades = React.useMemo(() => {
    const set = new Set<string>();
    for (const s of sections) set.add(s.gradeLevel);
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [sections]);

  const shownSections = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return sections
      .filter((s) => (selectedGrade ? s.gradeLevel === selectedGrade : true))
      .map((s) => ({
        ...s,
        students: q
          ? s.students.filter(
              (st) =>
                st.lrn.toLowerCase().includes(q) ||
                st.name.toLowerCase().includes(q)
            )
          : s.students,
      }))
      .filter((s) => s.students.length > 0);
  }, [sections, query, selectedGrade]);

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <CardTitle>Behavioral Records Heatblocks</CardTitle>
          <CardDescription>
            One block per tracked student, color-coded by dominant anecdotal
            category.
          </CardDescription>
        </div>
        <CardAction className={styles.headerActions}>
          <div className={styles.search}>
            <Search className={styles.searchIcon} aria-hidden />
            <Input
              type="search"
              placeholder="Search LRN or name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search students"
              className={styles.searchInput}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={styles.dropdown}>
                <span>{selectedGrade ? `Grade ${selectedGrade}` : "All grades"}</span>
                <ChevronDown className={styles.dropdownIcon} aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className={styles.dropdownMenu}>
              {grades.map((g) => (
                <DropdownMenuItem
                  key={g}
                  className={styles.dropdownItem}
                  onSelect={() => onSelectGrade(g)}
                >
                  <span>Grade {g}</span>
                  {selectedGrade === g ? <Check className={styles.dropdownCheck} /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>

      <CardContent className={styles.content}>
        {isPending ? (
          <div className={styles.bands} aria-busy="true" aria-label="Loading student records">
            {Array.from({ length: 4 }).map((_, b) => (
              <div key={b} className={styles.band}>
                <Skeleton className={styles.skelHead} />
                <div className={styles.grid}>
                  {Array.from({ length: 6 }).map((__, i) => (
                    <div key={i} className={styles.skelBlock}>
                      <span className={styles.skelDot} aria-hidden />
                      <span className={styles.skelText}>
                        <Skeleton className={styles.skelName} />
                        <Skeleton className={styles.skelLrn} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className={styles.empty}>
            <CircleDot className={styles.emptyIcon} aria-hidden />
            <p>Could not load student records.</p>
          </div>
        ) : shownSections.length === 0 ? (
          <div className={styles.empty}>
            <CircleDot className={styles.emptyIcon} aria-hidden />
            <p>No students match the current filters.</p>
          </div>
        ) : (
          <div className={styles.bands}>
            {shownSections.map((section) => (
              <div key={section.sectionId} className={styles.band}>
                <div className={styles.head}>
                  <span className={styles.headTitle}>{section.section}</span>
                  <span className={styles.headCount}>
                    {section.students.length} students
                  </span>
                </div>
                <div className={styles.grid}>
                  {section.students.map((s, i) => {
                    const selected = selectedLrn === s.lrn;
                    return (
                      <button
                        key={s.lrn}
                        type="button"
                        className={`${styles.block} ${selected ? styles.blockSelected : ""}`}
                        style={{ animationDelay: `${Math.min(i, 24) * 18}ms` }}
                        onClick={() => onSelectLrn(selected ? null : s.lrn)}
                        aria-pressed={selected}
                        aria-label={`${s.name}, LRN ${s.lrn}, ${s.status}`}
                      >
                        <span
                          className={styles.dot}
                          style={{ backgroundColor: categoryColor(s) }}
                          aria-hidden
                        />
                        <span className={styles.blockText}>
                          <span className={styles.blockName}>{s.name}</span>
                          <span className={styles.blockLrn}>{s.lrn}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {!isPending && !isError && data ? (
          <div className={styles.legend} aria-label="Anecdotal category legend">
            <span className={styles.legendTitle}>Category</span>
            {CATEGORY_KEYS.map((key) => (
              <span key={key} className={styles.legendItem}>
                <span
                  className={styles.legendDot}
                  style={{ backgroundColor: CATEGORY_META[key].color }}
                  aria-hidden
                />
                {CATEGORY_META[key].label}
              </span>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}