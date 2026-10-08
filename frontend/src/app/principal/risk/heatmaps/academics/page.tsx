"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import { AcademicsHeader } from "./components/AcademicsHeader";
import { KpiStrip } from "./components/KpiStrip";
import { SubjectTrendChart } from "./components/SubjectTrendChart";
import { SubjectSectionBreakdown } from "./components/SubjectSectionBreakdown";
import { NeedsAttentionList } from "./components/NeedsAttentionList";
import {
  ALL_GRADES,
  gradeSortKey,
  round1,
  type AttentionItem,
  type BackendAcademicSummary,
  type CellData,
} from "./components/types";
import shell from "../components/heatmap.module.css";

function isBelow75(avg: number, subjectCount: number): boolean {
  return subjectCount > 0 && avg < 75;
}

export default function PrincipalAcademicHeatmapsPage() {
  const [gradeFilter, setGradeFilter] = usePersistentState<string>(
    "academic-heatmap:grade",
    ALL_GRADES
  );

  const { activeTerm } = useTerm();
  const termId = activeTerm?.termId ?? null;
  const { data, isPending, dataUpdatedAt } = useQuery({
    queryKey: ["academic-insights", "live", termId],
    queryFn: async () => {
      const res = await apiClient.get<BackendAcademicSummary>("/api/academics", {
        params: { mode: "raw" },
      });
      return res.data;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const sections = React.useMemo(() => {
    const list = data?.sections ?? [];
    return [...list].sort(
      (a, b) =>
        gradeSortKey(a.grade) - gradeSortKey(b.grade) ||
        a.section.localeCompare(b.section)
    );
  }, [data]);

  const allStudents = React.useMemo(
    () => sections.flatMap((s) => s.students),
    [sections]
  );
  const gradedStudents = React.useMemo(
    () => allStudents.filter((st) => st.subjects.length > 0),
    [allStudents]
  );
  const below = React.useMemo(
    () =>
      gradedStudents.filter((st) => isBelow75(st.overallAverage, st.subjects.length))
        .length,
    [gradedStudents]
  );
  const riskySections = React.useMemo(
    () =>
      sections.filter((s) =>
        s.students.some((st) => isBelow75(st.overallAverage, st.subjects.length))
      ).length,
    [sections]
  );

  const { data: catalog } = useQuery({
    queryKey: ["academic-subject-catalog"],
    queryFn: async () => {
      const res = await apiClient.get<{
        subjects: { name: string; gradeLevel: number }[];
      }>("/api/academics/assign/subjects");
      return res.data.subjects ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const subjects = React.useMemo(() => {
    const set = new Set<string>();
    const wanted =
      gradeFilter === ALL_GRADES
        ? null
        : Number(String(gradeFilter).replace(/\D/g, ""));
    for (const c of catalog ?? []) {
      if (wanted == null || c.gradeLevel === wanted) set.add(c.name);
    }
    for (const s of sections) {
      if (gradeFilter !== ALL_GRADES && s.grade !== gradeFilter) continue;
      for (const st of s.students) {
        for (const subj of st.subjects) set.add(subj.subject);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [sections, catalog, gradeFilter]);

  const cellByKey = React.useMemo(() => {
    const acc = new Map<string, { sum: number; count: number; below: number }>();
    for (const s of sections) {
      for (const st of s.students) {
        for (const subj of st.subjects) {
          const key = `${s.sectionId}::${subj.subject}`;
          const entry = acc.get(key) ?? { sum: 0, count: 0, below: 0 };
          entry.sum += subj.transmutedGrade;
          entry.count += 1;
          if (subj.transmutedGrade < 75) entry.below += 1;
          acc.set(key, entry);
        }
      }
    }
    const out: Record<string, CellData> = {};
    for (const [key, entry] of acc) {
      if (entry.count === 0) continue;
      out[key] = {
        avg: round1(entry.sum / entry.count),
        graded: entry.count,
        below: entry.below,
      };
    }
    return out;
  }, [sections]);

  const attention = React.useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    for (const s of sections) {
      for (const subj of subjects) {
        const cell = cellByKey[`${s.sectionId}::${subj}`];
        if (cell && cell.avg < 75) {
          items.push({
            sectionId: s.sectionId,
            section: s.section,
            subject: subj,
            avg: cell.avg,
            graded: cell.graded,
            below: cell.below,
          });
        }
      }
    }
    return items.sort((a, b) => a.avg - b.avg).slice(0, 8);
  }, [sections, subjects, cellByKey]);

  const grades = React.useMemo(() => {
    const set = new Set(sections.map((s) => s.grade));
    return Array.from(set).sort((a, b) => gradeSortKey(a) - gradeSortKey(b));
  }, [sections]);

  React.useEffect(() => {
    if (gradeFilter !== ALL_GRADES && grades.length > 0 && !grades.includes(gradeFilter)) {
      setGradeFilter(ALL_GRADES);
    }
  }, [grades, gradeFilter, setGradeFilter]);

  const [selectedSubject, setSelectedSubject] = React.useState<string | null>(null);
  const [prevGradeFilter, setPrevGradeFilter] = React.useState(gradeFilter);
  if (prevGradeFilter !== gradeFilter) {
    setPrevGradeFilter(gradeFilter);
    setSelectedSubject(null);
  } else if (selectedSubject && !subjects.includes(selectedSubject)) {
    setSelectedSubject(null);
  }

  const breakdown = React.useMemo<AttentionItem[]>(() => {
    if (!selectedSubject) return [];
    const items: AttentionItem[] = [];
    for (const s of sections) {
      if (gradeFilter !== ALL_GRADES && s.grade !== gradeFilter) continue;
      const cell = cellByKey[`${s.sectionId}::${selectedSubject}`];
      if (!cell) continue;
      items.push({
        sectionId: s.sectionId,
        section: s.section,
        subject: selectedSubject,
        avg: cell.avg,
        graded: cell.graded,
        below: cell.below,
      });
    }
    return items.sort((a, b) => a.avg - b.avg);
  }, [sections, cellByKey, selectedSubject, gradeFilter]);

  return (
    <div className={shell.shell}>
      <div className={shell.layout}>
        <section className={shell.page}>
          <AcademicsHeader
            grades={grades}
            gradeFilter={gradeFilter}
            onGradeFilterChange={setGradeFilter}
            dataUpdatedAt={dataUpdatedAt}
          />
          <KpiStrip
            below={below}
            gradedTotal={gradedStudents.length}
            riskySections={riskySections}
            sectionCount={sections.length}
            isPending={isPending}
          />
          <SubjectTrendChart
            sections={sections}
            subjects={subjects}
            grades={grades}
            gradeFilter={gradeFilter}
            isPending={isPending}
            selectedSubject={selectedSubject}
            onSelectSubject={setSelectedSubject}
          />
          {selectedSubject ? (
            <SubjectSectionBreakdown
              subject={selectedSubject}
              gradeFilter={gradeFilter}
              items={breakdown}
              onClear={() => setSelectedSubject(null)}
            />
          ) : null}
          <NeedsAttentionList items={attention} isPending={isPending} />
        </section>
      </div>
    </div>
  );
}
