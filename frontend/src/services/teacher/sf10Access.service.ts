"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export type AccessStatus = "pending" | "approved" | "denied";

export interface MyAccessRequest {
  id: string;
  sectionId: string;
  section: string;
  gradeLevel: string;
  reason: string;
  requestedLrns: string[];
  status: AccessStatus;
  decisionReason: string | null;
  requestedAt: string;
  decidedAt: string | null;
  total: number;
  has: number;
  missing: number;
}

export interface VerificationRecord {
  id: string;
  source: string;
  status: string;
  fileUrl: string | null;
  verifiedAt: string | null;
  validatedAt: string | null;
  currentVersion: number;
}

export interface HasRow {
  lrn: string;
  name: string;
  /** Persisted sprite mascot (StudentMascot pool); null falls back to the derived one. */
  mascot: string | null;
  hasAccount: boolean;
  gradeLevel: string;
  section: string;
  sf10Status: "verified" | "validated" | "pending";
  /** Per-student grant (whole-request approval grants every row). */
  approved: boolean;
  /** ISO timestamp of the per-student grant, if granted individually. */
  approvedAt?: string | null;
  record: VerificationRecord | null;
}

export interface MissingRow {
  lrn: string;
  name: string;
  /** Persisted sprite mascot (StudentMascot pool); null falls back to the derived one. */
  mascot: string | null;
  hasAccount: boolean;
  gradeLevel: string;
  section: string;
}

export interface VerificationResult {
  requestId: string;
  section: string;
  gradeLevel: string;
  status: string;
  requestedLrns: string[];
  canDownload: boolean;
  canEdit: boolean;
  summary: { total: number; has: number; missing: number };
  hasSf10: HasRow[];
  missingSf10: MissingRow[];
}

export async function fetchMyAccessRequests(): Promise<MyAccessRequest[]> {
  const { data } = await apiClient.get<{ requests: MyAccessRequest[] }>(
    "/api/teacher/advisory/sf10-access-requests",
  );
  return data.requests;
}

export async function createAccessRequest(payload: {
  sectionId: string;
  reason: string;
  studentLrns?: string[];
}): Promise<{ id: string; status: string }> {
  const { data } = await apiClient.post<{ id: string; status: string }>(
    "/api/teacher/advisory/sf10-access-requests",
    payload,
  );
  return data;
}

export async function fetchMyVerification(requestId: string): Promise<VerificationResult> {
  const { data } = await apiClient.get<VerificationResult>(
    `/api/teacher/advisory/sf10-access-requests/${requestId}/records`,
  );
  return data;
}

export function useMyAccessRequests(enabled = true) {
  return useQuery<MyAccessRequest[]>({
    queryKey: ["teacher-sf10-access"],
    queryFn: fetchMyAccessRequests,
    enabled,
    staleTime: 30_000,
  });
}

export function useMyVerification(requestId: string | null) {
  return useQuery<VerificationResult>({
    queryKey: ["teacher-sf10-access", requestId, "records"],
    queryFn: () => fetchMyVerification(requestId as string),
    enabled: !!requestId,
    staleTime: 30_000,
  });
}
