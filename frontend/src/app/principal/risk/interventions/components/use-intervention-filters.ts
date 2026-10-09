"use client";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import type { RiskLevelKey } from "../types";
export function useInterventionFilters() {
  const [query, setQuery] = usePersistentState<string>(
    "zentra.interventions.search",
    ""
  );
  const [riskFilter, setRiskFilter] = usePersistentState<"all" | RiskLevelKey>(
    "zentra.interventions.risk",
    "all"
  );
  const hasActiveFilters = riskFilter !== "all";
  return {
    query,
    setQuery,
    riskFilter,
    setRiskFilter,
    hasActiveFilters,
  };
}
