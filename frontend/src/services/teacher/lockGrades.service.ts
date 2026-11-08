"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { useTerm } from "@/lib/term/TermContext";

export type LockGradesView = "classes" | "advisees";

export interface LockGradesClassRow {
  id: string;
  subjectId: string;
  subject: string;
  subjectCode: string;
  sectionId: string;
  section: string;
  gradeLevel: string;
  learners: number;
  computed: number;
  ready: number;
  locked: number;
  approved: number;
}

export interface LockGradesSubjectRow {
  subject: string;
  subjectId: string;
  computedAverage: number | null;
  transmutedGrade: number | null;
  remarks: string | null;
  lockStatus: "unlocked" | "locked" | "adviser_approved" | string | null;
  hiddenByTeacher?: boolean;
}

export interface LockGradesAdviseeRow {
  studentId: string;
  name: string;
  lrn: string;
  section: string;
  sectionId: string;
  hasAccount: boolean;
  subjects: LockGradesSubjectRow[];
  summary: {
    subjects: number;
    graded: number;
    locked: number;
    approved: number;
  };
}

export interface LockGradesSection {
  id: string;
  name: string;
  gradeLevel: string;
}

export interface LockGradesData {
  view: LockGradesView;
  termId: string | null;
  isSubjectTeacher: boolean;
  isAdviser: boolean;
  gates: { linked: boolean; termGrant: boolean };
  classes: LockGradesClassRow[];
  advisorySections: LockGradesSection[];
  advisees: LockGradesAdviseeRow[];
}

export async function fetchLockGrades(view: LockGradesView): Promise<LockGradesData> {
  const { data } = await apiClient.get<LockGradesData>("/api/teacher/lock-grades", {
    params: { view },
  });
  return data;
}

export function lockGradesKey(
  teacherId: string | null | undefined,
  termKey: string,
  view: LockGradesView,
) {
  return ["teacher-lock-grades", teacherId ?? "anon", termKey, view] as const;
}

export function useLockGrades(view: LockGradesView) {
  const session = useSession();
  const { activeTerm, termReady } = useTerm();
  const teacherId = session?.sub ?? null;
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  return useQuery<LockGradesData>({
    queryKey: lockGradesKey(teacherId, termKey, view),
    queryFn: () => fetchLockGrades(view),
    enabled: !!teacherId && termReady,
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });
}
