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

export function studentListKey(
  teacherId: string | null | undefined,
  pick: ClassPick | null,
) {
  return ["teacher-student-list", teacherId ?? "anon", pick ? `${pick.kind}:${pick.id}` : "first"] as const;
}

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
