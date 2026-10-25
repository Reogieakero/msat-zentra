import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { StudentHoverStats } from "./academics";

/**
 * Live per-student stats for the academics hover card. No cache TTL — the
 * card is opened on demand, so it always asks the API for the current
 * attendance / anecdote / average picture for the active term.
 */
export function useStudentHoverStats(studentId: string | null, termKey = "active") {
  return useQuery({
    queryKey: ["academics", "student-stats", studentId, termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<StudentHoverStats>(
        `/api/academics/students/${encodeURIComponent(studentId as string)}/stats`,
      );
      return data;
    },
    enabled: !!studentId,
    staleTime: 0,
    gcTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
