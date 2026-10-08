"use client";
import * as React from "react";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import type { RiskSnapshotStudent, RiskLevelKey } from "../types";
import { gradeNum } from "./intervention-helpers";
export function useInterventionFilters(students: RiskSnapshotStudent[]) {
  const [query, setQuery] = usePersistentState<string>(
    "zentra.interventions.search",
    ""
  );
  const [riskFilter, setRiskFilter] = usePersistentState<"all" | RiskLevelKey>(
    "zentra.interventions.risk",
    "all"
  );
  const [sectionFilter, setSectionFilter] = usePersistentState<string>(
    "zentra.interventions.section",
    "all"
  );
  const sections = React.useMemo(() => {
    const seen = new Set<string>();
    for (const s of students) {
      if (s.section && s.section !== "—" && !seen.has(s.section)) seen.add(s.section);
    }
    return Array.from(seen).sort(
      (a, b) => gradeNum(a) - gradeNum(b) || a.localeCompare(b)
    );
  }, [students]);
  const gradeGroups = React.useMemo(() => {
    const map = new Map<number, string[]>();
    for (const s of sections) {
      const g = gradeNum(s);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [sections]);
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      const matchesQuery =
        !q || s.studentName.toLowerCase().includes(q) || s.lrn.toLowerCase().includes(q);
      const matchesSection = sectionFilter === "all" || s.section === sectionFilter;
      const matchesRisk = riskFilter === "all" || s.riskLevel === riskFilter;
      return matchesQuery && matchesSection && matchesRisk;
    });
  }, [students, query, sectionFilter, riskFilter]);
  const hasActiveFilters = sectionFilter !== "all" || riskFilter !== "all";
  return {
    query,
    setQuery,
    riskFilter,
    setRiskFilter,
    sectionFilter,
    setSectionFilter,
    sections,
    gradeGroups,
    filtered,
    hasActiveFilters,
  };
}
