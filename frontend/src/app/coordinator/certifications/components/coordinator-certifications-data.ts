"use client";

import {
  fetchCoordinatorApprovals,
  fetchCoordinatorReferrals,
  type AdmApprovalRow,
  type AdmCaseRow,
  type AdmEligibility,
} from "../../components/coordinator-data";

export type CertStatus =
  | "prepared"
  | "awaiting"
  | "revision"
  | "approved";

export type CertStatusFilter = "all" | CertStatus;

export interface CertRecord {
  id: string;
  student: string;
  lrn: string;
  grade: string;
  eligibilityStatus: AdmEligibility;
  status: CertStatus;
  datePrepared: string | null;
  approvalDate: string | null;
  approvedBy: string | null;
  formsCount: number;
}

export interface CertGradeCount {
  grade: string;
  count: number;
}

export interface CertSummary {
  total: number;
  prepared: number;
  awaiting: number;
  revision: number;
  approved: number;
  byGrade: CertGradeCount[];
}

export const CERT_STATUS_META: Record<
  CertStatus,
  { label: string; color: string }
> = {
  prepared: { label: "Prepared", color: "#fbbf24" },
  awaiting: { label: "Awaiting signature", color: "#e5e5e5" },
  revision: { label: "Needs revision", color: "#f87171" },
  approved: { label: "Approved", color: "#4ade80" },
};

/* A case at the certification stage is a prepared recommendation waiting
   for the coordinator to endorse. At principal_approval an eligible,
   unsigned case is locked awaiting the Principal's signature; an unsigned
   case that is not cleanly eligible needs revision (covers Principal
   returns, which reset eligibility to pending, and premature forwards).
   Anything the Principal signed is approved. */
export function deriveCertStatus(row: {
  stage?: string;
  eligibilityStatus: AdmEligibility;
  approvedBy: string | null;
}): CertStatus {
  if (row.approvedBy) return "approved";
  if (row.stage === "principal_approval") {
    return row.eligibilityStatus === "eligible" ? "awaiting" : "revision";
  }
  return "prepared";
}

function fromStageRow(r: AdmCaseRow): CertRecord {
  return {
    id: r.id,
    student: r.student,
    lrn: r.lrn,
    grade: r.grade,
    eligibilityStatus: r.eligibilityStatus,
    status: deriveCertStatus(r),
    datePrepared: r.datePrepared,
    approvalDate: r.approvalDate,
    approvedBy: r.approvedBy,
    formsCount: r.forms.length,
  };
}

function fromApprovalRow(r: AdmApprovalRow): CertRecord {
  return {
    id: r.id,
    student: r.student,
    lrn: r.lrn,
    grade: r.grade,
    eligibilityStatus: r.eligibilityStatus,
    status: "approved",
    datePrepared: null,
    approvalDate: r.approvalDate,
    approvedBy: r.approvedBy,
    formsCount: r.forms.length,
  };
}

const sortKey = (r: CertRecord) =>
  r.datePrepared ?? r.approvalDate ?? "";

export function mergeCertRecords(
  stageRows: AdmCaseRow[],
  approvalRows: AdmApprovalRow[],
): CertRecord[] {
  const seen = new Set<string>();
  const out: CertRecord[] = [];
  for (const r of stageRows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(fromStageRow(r));
  }
  for (const r of approvalRows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(fromApprovalRow(r));
  }
  // Newest first so the folder grid reads like a recent-files shelf.
  out.sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  return out;
}

export function summarizeCertRecords(rows: CertRecord[]): CertSummary {
  const byGrade = new Map<string, number>();
  let prepared = 0;
  let awaiting = 0;
  let revision = 0;
  let approved = 0;
  for (const r of rows) {
    if (r.status === "prepared") prepared += 1;
    else if (r.status === "awaiting") awaiting += 1;
    else if (r.status === "revision") revision += 1;
    else approved += 1;
    if (r.grade) byGrade.set(r.grade, (byGrade.get(r.grade) ?? 0) + 1);
  }
  const grades: CertGradeCount[] = [...byGrade.entries()]
    .map(([grade, count]) => ({ grade, count }))
    .sort((a, b) => {
      const ga = parseInt(a.grade.replace(/\D/g, ""), 10) || 0;
      const gb = parseInt(b.grade.replace(/\D/g, ""), 10) || 0;
      if (ga !== gb) return ga - gb;
      return a.grade.localeCompare(b.grade);
    });
  return {
    total: rows.length,
    prepared,
    awaiting,
    revision,
    approved,
    byGrade: grades,
  };
}

/* Summary reads are wide (limit 200) single requests — the backend pages
   in the database, so one round-trip per source replaces the old
   page-1-then-maybe-page-2 fan-out. The folder grid still paginates
   client-side (PAGE_SIZE) over the merged records. */
const CERT_SUMMARY_LIMIT = 200;

export async function fetchCertStageRows(
  stage: "certification" | "principal_approval",
  q: string,
  signal?: AbortSignal,
): Promise<AdmCaseRow[]> {
  const page = await fetchCoordinatorReferrals(1, {
    q: q || undefined,
    stage,
    limit: CERT_SUMMARY_LIMIT,
    signal,
  });
  return page.rows;
}

export async function fetchCertApprovalRows(
  q: string,
  signal?: AbortSignal,
): Promise<AdmApprovalRow[]> {
  const page = await fetchCoordinatorApprovals(1, {
    q: q || undefined,
    limit: CERT_SUMMARY_LIMIT,
    signal,
  });
  return page.rows;
}
