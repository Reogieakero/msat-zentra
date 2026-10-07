"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { useTerm } from "@/lib/term/TermContext";

export type AdviseeRiskLevel = "Low" | "Moderate" | "High";
export type AdviseeRiskFlag = "academic" | "attendance" | "behavioral";
export type DrawerSection = "grades" | "attendance" | "anecdotal";

export interface AdvisorySectionInfo {
  id: string;
  name: string;
  gradeLevel: string;
}

export interface AdviseeSubjectGrade {
  subject: string;
  code: string;
  computedAverage: number | null;
  transmutedGrade: number | null;
}

export interface AdviseeLiveGrade {
  subject: string;
  code: string;
  /** Live unweighted mean of recorded percentage scores — realtime,
   *  regardless of lock / finalization status. */
  average: number;
}

export interface AdviseeRow {
  studentId: string;
  name: string;
  lrn: string;
  birthdate: string | null;
  gender: string | null;
  section: string;
  riskLevel: AdviseeRiskLevel;
  flags: AdviseeRiskFlag[];
  attendanceRate: number;
  anecdotalCount: number;
  confidentialityTiers: string[];
  hasOpenFlag: boolean;
  openFlagCount: number;
  hasAccount: boolean;
  grades: AdviseeSubjectGrade[];
  liveGrades: AdviseeLiveGrade[];
}

export interface AdvisoryRosterSubject {
  name: string;
  code: string;
}

export interface AdvisoryRoster {
  advisorySections: AdvisorySectionInfo[];
  termId: string | null;
  students: AdviseeRow[];
  subjects: AdvisoryRosterSubject[];
}

export interface AdviseeGrade {
  subject: string;
  computedAverage: number | null;
  transmutedGrade: number | null;
  remarks: string | null;
  lockStatus: string;
}

export interface AdviseeReferral {
  id: string;
  target: string;
  status: string;
}

export interface AdviseeAdmCase {
  id: string;
  stage: string;
  eligibility: string;
}

export interface AdviseeGradeFlag {
  id: string;
  reason: string;
  note: string | null;
  status: string;
  subject: string;
  raisedBy: string;
  createdAt: string;
  resolutionNote: string | null;
  resolvedAt: string | null;
}

export interface AdviseeDetail {
  studentId: string;
  name: string;
  lrn: string;
  birthdate: string | null;
  gender: string | null;
  section: string;
  gradeLevel: string;
  grades: AdviseeGrade[];
  attendance: {
    rate: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
  };
  anecdotal: {
    count: number;
    tiers: string[];
    categories: string[];
  };
  referrals: AdviseeReferral[];
  admCases: AdviseeAdmCase[];
  gradeFlags: AdviseeGradeFlag[];
}

export async function fetchAdvisoryRoster(): Promise<AdvisoryRoster> {
  const { data } = await apiClient.get<AdvisoryRoster>("/api/teacher/advisory/students");
  return data;
}

// Cache lifetime mirrors the global QueryClient defaults (stale 30s, gc
// 5min) explicitly so back-navigation stays instant even if defaults change.
// Prefix invalidations on ["advisory-students"] still match scoped keys.
const ROSTER_STALE_MS = 30_000;
const ROSTER_GC_MS = 5 * 60_000;

/** Teacher + term scoped key — one teacher's advisees must never leak to
    another, and term switches refetch instead of serving stale rosters. */
export function advisoryRosterKey(
  teacherId: string | null | undefined,
  termKey = ""
) {
  return ["advisory-students", teacherId ?? "anon", termKey] as const;
}

/** Advisee roster shared by the students page and the attendance sheet, so
 *  visiting both fires the roster endpoint once per teacher. Waits for term
 *  hydration (termReady) so the heavy request fires once with the real key
 *  instead of twice (empty key, then refetch). */
export function useAdvisoryRoster() {
  const session = useSession();
  const { activeTerm, termReady } = useTerm();
  const teacherId = session?.sub ?? null;
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  return useQuery<AdvisoryRoster>({
    queryKey: advisoryRosterKey(teacherId, termKey),
    queryFn: fetchAdvisoryRoster,
    enabled: !!teacherId && termReady,
    retry: false,
    staleTime: ROSTER_STALE_MS,
    gcTime: ROSTER_GC_MS,
  });
}

export async function fetchAdviseeDetail(studentId: string): Promise<AdviseeDetail> {
  const { data } = await apiClient.get<AdviseeDetail>(
    `/api/teacher/advisory/students/${studentId}`
  );
  return data;
}

export async function enlistStudent(payload: { fullName: string; lrn: string }): Promise<AdviseeRow> {
  const { data } = await apiClient.post<AdviseeRow>("/api/teacher/advisory/roster", payload);
  return data;
}

export function formatBirthdate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// "in_progress" -> "In Progress", "guidance_counselor" -> "Guidance Counselor".
export function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
