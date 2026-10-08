"use client";
import type { LucideIcon } from "lucide-react";
export type StageState = "done" | "current" | "todo";
export interface Stage {
  key: string;
  label: string;
  sub: string;
  state: StageState;
  optional?: boolean;
  owner?: string;
  description?: string;
  principalAction?: boolean;
  Icon: LucideIcon;
}
export interface ReferralData {
  id?: string;
  studentName?: string;
  section?: string;
  lrn?: string;
  track?: string;
  status?: "pending" | "in_progress" | "resolved" | "dismissed" | "escalated" | "info_requested" | "follow_up";
  reason?: string;
  notes?: string | null;
  observationDate?: string;
  category?: string;
  referredToRole?: string;
  targetRole?: string;
  referredAt?: string;
  resolvedAt?: string | null;
  admReceiver?: string | null;
  hasParentMeeting?: boolean;
  meetingAttended?: boolean | null;
  hasHomeVisit?: boolean;
  admStage?: string | null;
  admStageLabel?: string | null;
  admEligibility?: string | null;
  admApproved?: boolean;
  admApprovedAt?: string | null;
  timeline?: { label: string; date: string }[];
}
export interface ReferralCanvasProps {
  referral: ReferralData | null;
  onCancelRequest?: (referral: { id: string; studentName: string }) => void;
  onDeleteRequest?: (referral: { id: string; studentName: string }) => void;
}
