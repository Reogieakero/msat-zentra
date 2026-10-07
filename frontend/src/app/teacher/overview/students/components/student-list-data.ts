"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";

export interface StudentListRow {
  studentId: string;
  name: string;
  lrn: string;
  hasAccount: boolean;
  /** Present elapsed meetups for this subject (worst-status-wins per day). */
  attendancePresent: number;
  /** Elapsed meetup dates for this subject × section × term (the sheet's denominator). */
  attendanceTotal: number;
  /** Attendance-sheet basis: present elapsed meetups ÷ elapsed meetups.
   *  Elapsed meetups with no take count as absent (0%, never blank);
   *  null only when nothing has elapsed yet. */
  attendancePercentage: number | null;
  computedAverage: number | null;
  /** Transmuted grade for this specific subject + term. Null when not yet encoded. */
  academicGrade: number | null;
}

export interface StudentListClass {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  sectionId: string;
  sectionName: string;
  gradeLevel: string;
}

export interface StudentListClassItem {
  id: string;
  subject: string;
  /** Subject code (e.g. AP, ESP) — shown as the rail label. */
  code: string;
  gradeLevel: string;
  section: string;
  studentCount: number;
}

export interface AdvisorySectionItem {
  id: string;
  name: string;
  gradeLevel: string;
  studentCount: number;
}

export interface AdvisorySectionInfo {
  id: string;
  name: string;
  gradeLevel: string;
}

/** Rail pick: a handled subject × section, or an advised section. */
export interface ClassPick {
  kind: "class" | "advisory";
  id: string;
}

export interface StudentListResponse {
  /** Handled subject × section rail — same shape as the overview `classes`. */
  classes: StudentListClassItem[];
  /** Advised-section rail — empty for regular teachers. */
  advisorySections: AdvisorySectionItem[];
  class: StudentListClass | null;
  advisorySection: AdvisorySectionInfo | null;
  students: StudentListRow[];
}

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
