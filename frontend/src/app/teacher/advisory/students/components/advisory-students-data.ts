"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";

export type AdviseeRiskLevel = "Low" | "Moderate" | "High";
export type AdviseeRiskFlag = "academic" | "attendance" | "behavioral";
export type DrawerSection = "grades" | "attendance" | "anecdotal";

export interface AdvisorySectionInfo {
  id: string;
  name: string;
  gradeLevel: string;
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
}

export interface AdvisoryRoster {
  advisorySections: AdvisorySectionInfo[];
  termId: string | null;
  students: AdviseeRow[];
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

/** Teacher-scoped key — one teacher's advisees must never leak to another. */
export function advisoryRosterKey(teacherId: string | null | undefined) {
  return ["advisory-students", teacherId ?? "anon"] as const;
}

/** Advisee roster shared by the students page and the attendance sheet, so
 *  visiting both fires the roster endpoint once per teacher. */
export function useAdvisoryRoster() {
  const session = useSession();
  const teacherId = session?.sub ?? null;
  return useQuery({
    queryKey: advisoryRosterKey(teacherId),
    queryFn: fetchAdvisoryRoster,
    enabled: !!teacherId,
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
