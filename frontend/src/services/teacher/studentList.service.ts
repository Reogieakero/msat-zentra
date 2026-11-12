"use client";

import { useLiveQuery } from "@/lib/api/live";
import { apiClient } from "@/lib/api/client";
import { liveQueryOptions } from "@/lib/api/live";
import { useSession } from "@/lib/auth/useSession";
import { useTerm } from "@/lib/term/TermContext";
import type { ClassPick, StudentListResponse } from "./studentList.types";

export async function fetchStudentList(pick: ClassPick | null): Promise<StudentListResponse> {
  const { data } = await apiClient.get<StudentListResponse>(
    "/api/teacher/overview/student-list",
    pick
      ? {
          params:
            pick.kind === "advisory"
              ? { advisorySectionId: pick.id }
              : { classId: pick.id },
        }
      : undefined,
  );
  return data;
}

export function studentListKey(
  teacherId: string | null | undefined,
  pick: ClassPick | null,
  termKey = "",
) {
  return [
    "teacher-student-list",
    teacherId ?? "anon",
    termKey,
    pick ? `${pick.kind}:${pick.id}` : "first",
  ] as const;
}

export function useStudentList(pick: ClassPick | null) {
  const session = useSession();
  const { activeTerm } = useTerm();
  const teacherId = session?.sub ?? null;
  // Term-scoped key: grades, attendance and anecdotes in the response belong
  // to the selected term, so a term switch must never reuse the old payload.
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  return useLiveQuery({
    queryKey: studentListKey(teacherId, pick, termKey),
    queryFn: () => fetchStudentList(pick),
    enabled: !!teacherId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: (previous) => previous,
    retry: false,
    ...liveQueryOptions,
  });
}
