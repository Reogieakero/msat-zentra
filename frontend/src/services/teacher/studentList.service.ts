"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
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

/** Teacher-scoped roster key — one teacher's class roster never leaks to another session. */
export function studentListKey(
  teacherId: string | null | undefined,
  pick: ClassPick | null,
) {
  return ["teacher-student-list", teacherId ?? "anon", pick ? `${pick.kind}:${pick.id}` : "first"] as const;
}

/** Roster for the picked card: handled subject × section or advised section.
 *  `pick` null serves the default (first advisory section for advisers,
 *  first handled class otherwise) AND both rails — one request renders the
 *  whole page, no overview wait. */
export function useStudentList(pick: ClassPick | null) {
  const session = useSession();
  const teacherId = session?.sub ?? null;
  return useQuery({
    queryKey: studentListKey(teacherId, pick),
    queryFn: () => fetchStudentList(pick),
    enabled: !!teacherId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: (previous) => previous,
    retry: false,
  });
}
