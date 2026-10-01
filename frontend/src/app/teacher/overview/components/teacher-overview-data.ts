"use client";

import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";

export interface TeacherClassRow {
  id: string;
  subject: string;
  gradeLevel: string;
  section: string;
  studentCount: number;
}

export interface TeacherKpiRow {
  classCount: number;
  pendingAssessments: number;
  openFlags: number;
  studentCount: number;
}

export interface TeacherActivityRow {
  action: string;
  target: string;
  when: string;
}

export interface AdvisoryStatusRow {
  studentId: string;
  name: string;
  lrn: string;
  section: string;
  riskLevel: "Low" | "Moderate" | "High";
  flag: "academic" | "attendance" | "behavioral" | "none";
  flags: ("academic" | "attendance" | "behavioral")[];
}

export interface SubjectAssessmentRow {
  id: string;
  subject: string;
  gradeLevel: string;
  section: string;
  type: "WW" | "PT" | "E";
  title: string;
  dueDate: string;
  status: string;
}

export interface ClassAverageRow {
  subject: string;
  gradeLevel: string;
  section: string;
  average: number;
  assessed: number;
  students: number;
}

export interface AdvisorySectionInfo {
  id: string;
  name: string;
  gradeLevel: string;
}

export interface ClassStudentRow {
  studentId: string;
  name: string;
  lrn: string;
  sectionId: string;
  section: string;
  /** Subject codes the teacher handles in this student's section — one row. */
  subjects: string[];
  riskLevel: "Low" | "Moderate" | "High";
  /** Academic + attendance only — regular teachers record no anecdotal. */
  flags: ("academic" | "attendance")[];
}

export interface TeacherOverviewData {
  teacherName: string;
  isAdviser: boolean;
  isMasterTeacher: boolean;
  masterTeacherEligible: boolean;
  masterTeacherTaken: boolean;
  masterTeacherHolderName: string | null;
  advisorySection: AdvisorySectionInfo | null;
  kpi: TeacherKpiRow;
  atRiskFactors: {
    academic: number;
    attendance: number;
    behavioral: number;
  };
  atRiskStudents: number;
  classes: TeacherClassRow[];
  classStudents: ClassStudentRow[];
  recentActivity: TeacherActivityRow[];
  advisory: {
    students: AdvisoryStatusRow[];
  };
  subjectClasses: {
    assessments: SubjectAssessmentRow[];
    standings: ClassAverageRow[];
  };
}

/** Critical first-paint payload: identity, classes, advisory. No aggregations. */
export interface TeacherOverviewCritical {
  teacherName: string;
  isAdviser: boolean;
  isMasterTeacher: boolean;
  masterTeacherEligible: boolean;
  masterTeacherTaken: boolean;
  masterTeacherHolderName: string | null;
  advisorySection: AdvisorySectionInfo | null;
  kpi: TeacherKpiRow;
  atRiskFactors: {
    academic: number;
    attendance: number;
    behavioral: number;
  };
  atRiskStudents: number;
  classes: TeacherClassRow[];
  classStudents: ClassStudentRow[];
  advisory: {
    students: AdvisoryStatusRow[];
  };
}

/** Lazy secondary payload: gradebook widgets + activity. */
export interface TeacherOverviewSecondary {
  assessments: SubjectAssessmentRow[];
  standings: ClassAverageRow[];
  recentActivity: TeacherActivityRow[];
  pendingAssessments: number;
  openFlags: number;
}

export async function fetchTeacherOverview(): Promise<TeacherOverviewCritical> {
  const { data } = await apiClient.get<TeacherOverviewCritical>(
    "/api/teacher/overview?scope=critical",
  );
  return data;
}

export async function fetchTeacherOverviewSecondary(): Promise<TeacherOverviewSecondary> {
  const { data } = await apiClient.get<TeacherOverviewSecondary>(
    "/api/teacher/overview?scope=secondary",
  );
  return data;
}

// Cache lifetime mirrors the global QueryClient defaults (stale 30s, gc 5min)
// explicitly so the overview's instant-back-navigation contract survives
// future default changes. Prefix invalidations on ["teacher-overview"] still
// match these scoped keys (exact: false), so realtime + mutation refresh
// keeps working unchanged.
const OVERVIEW_STALE_MS = 30_000;
const OVERVIEW_GC_MS = 5 * 60_000;

/** Teacher-scoped key — two teachers must never share cached private data. */
export function teacherOverviewKey(teacherId: string | null | undefined) {
  return ["teacher-overview", teacherId ?? "anon"] as const;
}

// Master-Teacher flag mirrored per teacher in localStorage so the sidebar
// tab and the schedule gate paint correctly on the very first frame after a
// hard refresh — before the overview query resolves. Keys are teacher-scoped
// and logout wipes every `zentra.*` key, so a flag can never leak across
// accounts. The live overview always overwrites this on fetch.
function masterTeacherCacheKey(teacherId: string | null | undefined): string | null {
  return teacherId ? `zentra.masterTeacher.${teacherId}` : null;
}

export function readCachedMasterTeacher(teacherId: string | null | undefined): boolean {
  if (typeof window === "undefined") return false;
  const key = masterTeacherCacheKey(teacherId);
  if (!key) return false;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writeCachedMasterTeacher(
  teacherId: string | null | undefined,
  value: boolean,
): void {
  const key = masterTeacherCacheKey(teacherId);
  if (!key || typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
  } catch {
    // Private mode / blocked storage — the live overview stays authoritative.
  }
}

function subscribeMasterTeacherCache(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

// Adviser flag mirrored per teacher in localStorage so the sidebar branch
// paints correctly on the very first frame after a hard refresh — before the
// overview query resolves. Same teacher-scoped, logout-wiped contract as the
// master-teacher cache above. The live overview always overwrites this.
function adviserCacheKey(teacherId: string | null | undefined): string | null {
  return teacherId ? `zentra.adviser.${teacherId}` : null;
}

export function readCachedAdviser(teacherId: string | null | undefined): boolean | null {
  if (typeof window === "undefined") return null;
  const key = adviserCacheKey(teacherId);
  if (!key) return null;
  try {
    const v = window.localStorage.getItem(key);
    if (v === null) return null;
    return v === "1";
  } catch {
    return null;
  }
}

export function writeCachedAdviser(
  teacherId: string | null | undefined,
  value: boolean,
): void {
  const key = adviserCacheKey(teacherId);
  if (!key || typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(key, "1");
    else window.localStorage.setItem(key, "0");
  } catch {
    // Private mode / blocked storage — the live overview stays authoritative.
  }
}

function subscribeAdviserCache(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

// Hydration-safe first-frame flag (null = unknown yet). Renders the server
// snapshot (null) through hydration, then flips to the cached value on the
// client. Callers treat null as "still loading — show full nav".
export function useCachedAdviser(teacherId: string | null | undefined): boolean | null {
  return useSyncExternalStore(
    subscribeAdviserCache,
    () => readCachedAdviser(teacherId),
    () => null,
  );
}

// Hydration-safe first-frame flag. A `useState` initializer reading
// localStorage renders different tabs on the server (no window) vs the
// client (cached "1") — a hydration mismatch. `useSyncExternalStore` renders
// the server snapshot (false) through hydration, then flips to the cached
// value on the client with a normal re-render. Same-tab toggles flow through
// the overview query cache; the `storage` listener keeps other open tabs in
// sync for free.
export function useCachedMasterTeacher(teacherId: string | null | undefined): boolean {
  return useSyncExternalStore(
    subscribeMasterTeacherCache,
    () => readCachedMasterTeacher(teacherId),
    () => false,
  );
}

export function teacherOverviewSecondaryKey(
  teacherId: string | null | undefined,
) {
  return ["teacher-overview-secondary", teacherId ?? "anon"] as const;
}

/** Critical payload (identity + classes + advisory). Shared by overview,
 *  gradebook, and advisory-students so one fetch serves all three pages. */
export function useTeacherOverview() {
  const session = useSession();
  const teacherId = session?.sub ?? null;
  return useQuery({
    queryKey: teacherOverviewKey(teacherId),
    queryFn: async () => {
      const payload = await fetchTeacherOverview();
      writeCachedMasterTeacher(teacherId, payload.isMasterTeacher);
      writeCachedAdviser(teacherId, payload.isAdviser);
      return payload;
    },
    enabled: !!teacherId,
    staleTime: OVERVIEW_STALE_MS,
    gcTime: OVERVIEW_GC_MS,
  });
}

/** Lazy secondary payload (assessments + standings + activity). */
export function useTeacherOverviewSecondary(enabled: boolean) {
  const session = useSession();
  const teacherId = session?.sub ?? null;
  return useQuery({
    queryKey: teacherOverviewSecondaryKey(teacherId),
    queryFn: fetchTeacherOverviewSecondary,
    enabled: enabled && !!teacherId,
    staleTime: OVERVIEW_STALE_MS,
    gcTime: OVERVIEW_GC_MS,
    placeholderData: (previous) => previous,
  });
}
