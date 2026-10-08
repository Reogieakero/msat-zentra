"use client";
import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { groupReferable, type ReferableRecord } from "./referable-group";
export function useReferableRecords(termKey: string) {
  const referablesQuery = useQuery<ReferableRecord[]>({
    queryKey: ["referableAnecdotal", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get("/api/anecdotal/referable");
      return Array.isArray(data) ? data : [];
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  });
  const students = React.useMemo(
    () => groupReferable(Array.isArray(referablesQuery.data) ? referablesQuery.data : []),
    [referablesQuery.data],
  );
  return { referablesQuery, students };
}
