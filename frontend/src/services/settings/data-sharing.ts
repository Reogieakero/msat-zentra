"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { useTerm } from "@/lib/term/TermContext";

export interface DataSharingState {
  shareStudentData: boolean;
  shareUpdatedAt: string | null;
  handledClasses: { subject: string; section: string }[];
}

export function dataSharingKey(userId: string | null | undefined, termKey: string) {
  return ["teacher-data-sharing", userId ?? "anon", termKey] as const;
}

export async function fetchDataSharing(): Promise<DataSharingState> {
  const { data } = await apiClient.get<DataSharingState>("/api/teacher/settings/data-sharing");
  return data;
}

export function useTeacherDataSharing() {
  const session = useSession();
  const { activeTerm } = useTerm();
  const userId = session?.sub ?? null;
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  return useQuery({
    queryKey: dataSharingKey(userId, termKey),
    queryFn: fetchDataSharing,
    enabled: !!userId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

export async function setDataSharing(shareStudentData: boolean): Promise<DataSharingState> {
  const { data } = await apiClient.patch<DataSharingState>("/api/teacher/settings/data-sharing", {
    shareStudentData,
  });
  return data;
}
