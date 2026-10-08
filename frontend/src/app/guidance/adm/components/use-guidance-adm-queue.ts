"use client";
import * as React from "react";
import { Eye, Send } from "lucide-react";
import { useGuidanceInvalidate, useGuidanceMutation } from "../../overview/components/use-guidance-mutation";
import type { AdmQueueRowVM } from "@/components/adm-queue/AdmQueueTable";
import type { GuidanceAdmCase } from "@/services/guidance/adm.types";
import { reviewAdmConsultation } from "@/services/guidance/adm.service";
import { fetchOcForm01Detail, type OcForm01Detail } from "@/components/ocform01/ocform01";
import { buildGcForm03Data, consultRecommendation } from "@/services/guidance/gcform03.service";
import type { GcForm03Data } from "@/services/guidance/gcform03.types";
function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const month = months[Number(match[2]) - 1] ?? match[2];
  return `${month} ${Number(match[3])}, ${match[1]}`;
}
function queueStatus(row: GuidanceAdmCase): { label: string; variant: "warning" | "success" | "destructive" | "secondary" } {
  if (row.reviewed === false) return { label: "Needs review", variant: "warning" };
  if (row.referralStatus === "dismissed") return { label: "Rejected", variant: "destructive" };
  if (row.referralStatus === "in_progress") return { label: "Endorsed", variant: "success" };
  return { label: "Reviewed", variant: "secondary" };
}
function queueLatest(row: GuidanceAdmCase): { label: string; icon: "eye" | "send" } {
  if (row.reviewed === false) return { label: "Waiting on your review", icon: "eye" };
  if (row.referralStatus === "dismissed") return { label: "Rejected", icon: "send" };
  return { label: "Endorsed to ADM coordinator", icon: "send" };
}
export function useGuidanceAdmQueue(reviewQueue: GuidanceAdmCase[]) {
  const invalidateGuidance = useGuidanceInvalidate();
  const [reviewId, setReviewId] = React.useState<string | null>(null);
  const [rejectId, setRejectId] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [trackId, setTrackId] = React.useState<string | null>(null);
  const [gcRow, setGcRow] = React.useState<GuidanceAdmCase | null>(null);
  const [gcData, setGcData] = React.useState<GcForm03Data | null>(null);
  const [gcLoadingId, setGcLoadingId] = React.useState<string | null>(null);
  async function openGcForm(row: GuidanceAdmCase) {
    if (gcLoadingId) return;
    if (gcData && gcRow?.id === row.id) {
      setGcRow(row);
      return;
    }
    setGcLoadingId(row.id);
    try {
      let report: OcForm01Detail | null = null;
      try {
        if (row.anecdotalId) report = await fetchOcForm01Detail(row.anecdotalId);
      } catch {
        report = null;
      }
      setGcData(buildGcForm03Data(row, report, consultRecommendation(row.consultNote)));
      setGcRow(row);
    } finally {
      setGcLoadingId(null);
    }
  }
  const findCase = (id: string | null) =>
    reviewQueue.find((c) => c.id === id) ?? null;
  const activeReview = findCase(reviewId);
  const activeReject = findCase(rejectId);
  const activeTrack = findCase(trackId);
  const openReview = (row: GuidanceAdmCase) => {
    setReviewId(row.id);
  };
  const reviewMutation = useGuidanceMutation({
    mutationFn: ({
      referralId,
      outcome,
      text,
    }: {
      referralId: string;
      outcome: "endorse" | "reject";
      text: string;
    }) => reviewAdmConsultation(referralId, { recommendation: text, outcome }),
    successTitle: "Rejected from ADM",
    successDescription:
      () => "The case was closed with your reason kept on record. No further ADM action is needed.",
    errorTitle: "Could not reject the case",
    errorFallback: "The rejection did not go through. Check your connection and try again.",
    sourceId: (variables) => variables.referralId,
  });
  const closeReject = () => {
    setRejectId(null);
    setRejectReason("");
  };
  const vmRows = React.useMemo<AdmQueueRowVM[]>(
    () =>
      reviewQueue.map((row) => {
        const status = queueStatus(row);
        const latest = queueLatest(row);
        const risk =
          row.riskLevel === "High" ||
          row.riskLevel === "Moderate" ||
          row.riskLevel === "Low"
            ? row.riskLevel
            : undefined;
        return {
          id: row.id,
          lrn: row.lrn || "—",
          student: row.student,
          section: row.section,
          searchText: `${row.student} ${row.lrn} ${row.section} ${row.reason} ${row.referredBy}`,
          statusLabel: status.label,
          statusVariant: status.variant,
          riskLevel: risk,
          latestLabel: latest.label,
          LatestIcon: latest.icon === "eye" ? Eye : Send,
          actionTime: `${row.date}T00:00:00`,
          dateReferred: formatDate(row.date),
        };
      }),
    [reviewQueue]
  );
  const submitQuickReject = () => {
    if (!activeReject || !rejectReason.trim()) return;
    if (reviewMutation.isPending) return;
    reviewMutation.mutate(
      {
        referralId: activeReject.referralId,
        outcome: "reject",
        text: rejectReason.trim(),
      },
      {
        onSuccess: () => {
          closeReject();
        },
      }
    );
  };
  return {
    invalidateGuidance,
    reviewId,
    setReviewId,
    rejectId,
    setRejectId,
    rejectReason,
    setRejectReason,
    trackId,
    setTrackId,
    gcRow,
    setGcRow,
    gcData,
    gcLoadingId,
    openGcForm,
    activeReview,
    activeReject,
    activeTrack,
    openReview,
    reviewMutation,
    closeReject,
    vmRows,
    submitQuickReject,
  };
}
