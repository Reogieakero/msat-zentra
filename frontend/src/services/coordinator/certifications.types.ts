"use client";

// Certification board shapes for the coordinator desk. Pure types only.
// Row inputs (`AdmCaseRow`/`AdmApprovalRow`) come from the shared
// coordinator types.
import type {
  AdmApprovalRow,
  AdmCaseRow,
  AdmEligibility,
} from "./coordinator.types";

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
