"use client";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import type { RiskLevelKey } from "../types";

/** Plan-action tabs on the interventions board. */
export type InterventionActionFilter = "all" | "none" | "ongoing";

export function useInterventionFilters() {
  const [query, setQuery] = usePersistentState<string>(
    "zentra.interventions.search",
    ""
  );
  const [riskFilter, setRiskFilter] = usePersistentState<"all" | RiskLevelKey>(
    "zentra.interventions.risk",
    "all"
  );
  const [actionFilter, setActionFilter] =
    usePersistentState<InterventionActionFilter>(
      "zentra.interventions.action",
      "all"
    );
  const hasActiveFilters = riskFilter !== "all" || actionFilter !== "all";
  return {
    query,
    setQuery,
    riskFilter,
    setRiskFilter,
    actionFilter,
    setActionFilter,
    hasActiveFilters,
  };
}
