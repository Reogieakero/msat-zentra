"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { useTerm } from "@/lib/term/TermContext";

export interface TermContextTerm {
  id: string;
  termNumber: number;
  schoolYearId: string;
  schoolYearName: string;
  startDate: string | null;
  endDate: string | null;
}

export interface TermContextLearner {
  id: string;
  lrn: string;
  name: string;
  sectionId: string;
  section: string;
  gradeLevel: string;
  enlistedTermId: string | null;
}

export interface TermContextClassRef {
  id: string;
  subject: string;
  section: string;
}

export interface TermContextData {
  term: TermContextTerm | null;
  previousTerm: TermContextTerm | null;
  isAdviser: boolean;
  advisorySections: { id: string; name: string; gradeLevel: string }[];
  roster: {
    total: number;
    fingerprint: string;
    learners: TermContextLearner[];
  };
  newLearners: TermContextLearner[];
  diff: {
    added: TermContextLearner[];
    removed: { lrn: string; name: string; section: string }[];
  };
  classes: {
    current: TermContextClassRef[];
    previous: TermContextClassRef[];
    added: TermContextClassRef[];
    removed: TermContextClassRef[];
  };
  baseline: "previous-term" | "none";
  sameSchoolYear: boolean;
  sameAsPrevious: boolean | null;
  acknowledgedAt: string | null;
  changedSinceAck: boolean;
  needsConfirmation: boolean;
  reason: "first-visit" | "roster-changed" | null;
}

export async function fetchTermContext(): Promise<TermContextData> {
  const { data } = await apiClient.get<TermContextData>("/api/teacher/term-context");
  return data;
}

export function termContextKey(
  teacherId: string | null | undefined,
  termKey: string,
) {
  return ["teacher-term-context", teacherId ?? "anon", termKey] as const;
}

export function useTermContext() {
  const session = useSession();
  const { activeTerm, termReady } = useTerm();
  const teacherId = session?.sub ?? null;
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  return useQuery<TermContextData>({
    queryKey: termContextKey(teacherId, termKey),
    queryFn: fetchTermContext,
    enabled: !!teacherId && termReady && !!activeTerm?.termId,
    staleTime: 30_000,
  });
}

export async function confirmTermContext(input: {
  kind: "roster" | "classes";
  fingerprint: string;
  sameAsPrevious: boolean;
}): Promise<{ acknowledgedAt: string; sameAsPrevious: boolean }> {
  const { data } = await apiClient.post<{
    acknowledgedAt: string;
    sameAsPrevious: boolean;
  }>("/api/teacher/term-context/confirm", input);
  return data;
}

export function useConfirmTermContext() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: confirmTermContext,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-term-context"] });
    },
  });
}
