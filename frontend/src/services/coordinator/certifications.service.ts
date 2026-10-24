"use client";

import {
  fetchCoordinatorApprovals,
  fetchCoordinatorReferrals,
} from "./overview.service";
import type {
  AdmApprovalRow,
  AdmCaseRow,
  AdmEligibility,
} from "./coordinator.types";
import type {
  CertGradeCount,
  CertRecord,
  CertStatus,
  CertSummary,
} from "./certifications.types";
import { PAGE_SIZE } from "@/components/shared/pagination";

export const CERT_STATUS_META: Record<
  CertStatus,
  { label: string; color: string }
> = {
  prepared: { label: "Prepared", color: "#fbbf24" },
  awaiting: { label: "Awaiting signature", color: "#e5e5e5" },
  revision: { label: "Needs revision", color: "#f87171" },
  approved: { label: "Approved", color: "#4ade80" },
};

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

// The list endpoints are hard-capped at 15 rows per page (backend
// MAX_PAGE_SIZE), so the certifications summary walks the pages it needs
// instead of asking for a 200-row page (which the API rejects with 400).
// Bounded preview: max 10 pages (150 rows) per source, matching the
// guidance referral fan-out policy.
const CERT_SUMMARY_MAX_PAGES = 10;

export async function fetchCertStageRows(
  stage: "certification" | "principal_approval",
  q: string,
  signal?: AbortSignal,
): Promise<AdmCaseRow[]> {
  const first = await fetchCoordinatorReferrals(1, {
    q: q || undefined,
    stage,
    limit: PAGE_SIZE,
    signal,
  });
  const rows = Array.isArray(first?.rows) ? [...first.rows] : [];
  const pages = Math.min(first?.totalPages ?? 1, CERT_SUMMARY_MAX_PAGES);

  if (pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) =>
        fetchCoordinatorReferrals(i + 2, {
          q: q || undefined,
          stage,
          limit: PAGE_SIZE,
          signal,
        }),
      ),
    );
    for (const page of rest) {
      if (Array.isArray(page?.rows)) rows.push(...page.rows);
    }
  }

  return rows;
}

export async function fetchCertApprovalRows(
  q: string,
  signal?: AbortSignal,
): Promise<AdmApprovalRow[]> {
  const first = await fetchCoordinatorApprovals(1, {
    q: q || undefined,
    limit: PAGE_SIZE,
    signal,
  });
  const rows = Array.isArray(first?.rows) ? [...first.rows] : [];
  const pages = Math.min(first?.totalPages ?? 1, CERT_SUMMARY_MAX_PAGES);

  if (pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) =>
        fetchCoordinatorApprovals(i + 2, {
          q: q || undefined,
          limit: PAGE_SIZE,
          signal,
        }),
      ),
    );
    for (const page of rest) {
      if (Array.isArray(page?.rows)) rows.push(...page.rows);
    }
  }

  return rows;
}
