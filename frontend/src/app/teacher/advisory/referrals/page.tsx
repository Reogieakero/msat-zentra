"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { sileo } from "@/components/ui/sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ReferralsSidebar, type TrackFilter } from "./components/ReferralsSidebar";
import { ReferralCanvas } from "./components/ReferralCanvas";
import { ReferralComposer } from "./components/ReferralComposer";
import {
  ReferralCancelDialog,
  ReferralDeleteDialog,
  type ReferralActionTarget,
} from "./components/ReferralActionDialogs";
import { readLastViewedReferralId, writeLastViewedReferralId } from "./last-viewed";
import styles from "./components/referrals.module.css";

interface ReferralData {
  id: string;
  studentName: string;
  lrn: string;
  section: string;
  referredToRole: string;
  targetRole: string;
  referredBy: string;
  reason: string;
  notes?: string | null;
  status: "pending" | "in_progress" | "resolved" | "dismissed" | "escalated" | "info_requested" | "follow_up";
  referredAt: string;
  resolvedAt: string | null;
  anecdotalId: string;
  observationDate: string;
  anecdotalExcerpt: string;
  category: string;
  track: "adm" | "general";
  admReceiver: string | null;
  hasParentMeeting: boolean;
  meetingAttended: boolean | null;
  hasHomeVisit: boolean;
  admStage: string | null;
  admStageLabel: string | null;
  admEligibility: string | null;
  admApproved: boolean;
  admApprovedAt: string | null;
  timeline: { label: string; date: string }[];
}

function useTeacherReferrals() {
  return useQuery<ReferralData[]>({
    queryKey: ["myReferrals"],
    queryFn: async () => {
      const { data } = await apiClient.get("/api/referrals/mine");
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

function useReferableAnecdotal() {
  return useQuery({
    queryKey: ["referableAnecdotal"],
    queryFn: async () => {
      const { data } = await apiClient.get("/api/anecdotal/referable");
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export default function TeacherAdvisoryReferralsPage() {
  const queryClient = useQueryClient();
  const { data: referralsDataRaw, isPending: referralsPending } = useTeacherReferrals();
  const { data: referablesDataRaw, isPending: referablesPending } = useReferableAnecdotal();
  const referralsData = useMemo(() => referralsDataRaw ?? [], [referralsDataRaw]);
  const referablesData = useMemo(() => referablesDataRaw ?? [], [referablesDataRaw]);
  const isLoading = referralsPending;
  const isComposerLoading = referablesPending;
  const [query, setQuery] = useState("");
  const [trackFilter, setTrackFilter] = useState<TrackFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(() => readLastViewedReferralId());
  const [creating, setCreating] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<ReferralActionTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReferralActionTarget | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelPending, setCancelPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId) writeLastViewedReferralId(selectedId);
  }, [selectedId]);

  const needle = query.trim().toLowerCase();  const visible = useMemo(
    () =>
      referralsData.filter((r) => {
        if (trackFilter === "adm" && r.track !== "adm") return false;
        if (trackFilter === "general" && r.track === "adm") return false;
        if (!needle) return true;
        return (
          (r.studentName ?? "").toLowerCase().includes(needle) ||
          (r.lrn ?? "").toLowerCase().includes(needle) ||
          (r.targetRole ?? "").toLowerCase().includes(needle)
        );
      }),
    [referralsData, needle, trackFilter]
  );

  // LRNs with an open ADM case — the composer disables the ADM track for
  // these students (one open ADM referral per student).
  const admActiveLrns = useMemo(
    () =>
      referralsData
        .filter((r) => r.track === "adm" && r.status !== "dismissed" && r.status !== "resolved")
        .map((r) => r.lrn),
    [referralsData]
  );

  // If the just-submitted id is not in the list yet (refetch in flight),
  // fall back to the newest loaded case so the pipeline never blanks.
  const onCanvas = selectedId
    ? (referralsData.find((r) => r.id === selectedId) ?? referralsData[0] ?? null)
    : (referralsData[0] ?? null);
  // Never blank the canvas while matches exist: if the selected case is
  // filtered out by search, fall back to the first visible match so the
  // workflow tracking cards always display.
  const canvasVisible =
    onCanvas && visible.some((r) => r.id === onCanvas.id)
      ? onCanvas
      : (visible[0] ?? null);

  if (isLoading) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading referrals">
        <div className={styles.layout}>
          <ReferralsSidebar
            referrals={[]}
            selectedId={null}
            onSelect={handleSelect}
            onNew={handleNewReferral}
            query={query}
            onQueryChange={setQuery}
            trackFilter={trackFilter}
            onTrackFilterChange={setTrackFilter}
            loading
          />
          <div className={styles.body}>
            <div className={styles.workspace}>
              <div className={styles.skelCanvas} aria-busy="true" aria-label="Loading referable records">
                <div className={styles.skelCanvasHead}>
                  <div className={styles.skelCanvasId}>
                    <Skeleton className={styles.skelCanvasTitle} />
                    <Skeleton className={styles.skelCanvasSub} />
                  </div>
                  <Skeleton className={styles.skelCanvasBadge} />
                </div>
                <div className={styles.skelNodes}>
                  <Skeleton className={styles.skelNode} />
                  <Skeleton className={styles.skelNode} />
                  <Skeleton className={styles.skelNode} />
                  <Skeleton className={styles.skelNode} />
                </div>
                <div className={styles.skelCaseFile}>
                  <Skeleton className={styles.skelCaseCellWide} />
                  <Skeleton className={styles.skelCaseCellNarrow} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  function handleSelect(id: string) {
    setSelectedId(id);
  }

  function handleNewReferral() {
    setCreating(true);
  }

  async function handleCreateReferral(draft: {
    anecdotalId: string;
    track: string;
    admReceiver: string | null;
    targetRole: string;
    reason: string;
  }): Promise<{ id: string }> {
    const { data } = await apiClient.post(`/api/anecdotal/${draft.anecdotalId}/refer`, {
      referredToRole: draft.targetRole,
      reason: draft.reason,
      // ADM track: persist the picked consultation reviewer (nurse |
      // guidance_counselor | lrpc) so only the selected role acts on it.
      ...(draft.track === "adm" && draft.admReceiver
        ? { consultReviewer: draft.admReceiver }
        : {}),
    });
    return { id: data.id };
  }

  function handleCreated(created: { id: string }): void {
    queryClient.invalidateQueries({ queryKey: ["myReferrals"] });
    queryClient.invalidateQueries({ queryKey: ["referableAnecdotal"] });
    setSelectedId(created.id);
    setCreating(false);
    sileo.success({ title: "Referral submitted", description: "The receiving desk has been notified." });
  }

  // Backend errors arrive as { error: { code, message } } — surface the
  // server's message instead of a generic failure notice.
  function apiErrorMessage(err: unknown, fallback: string): string {
    if (typeof err === "object" && err !== null && "response" in err) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })
        .response?.data?.error?.message;
      if (message) return message;
    }
    return fallback;
  }

  function requestCancel(referral: { id: string; studentName: string }): void {
    setCancelTarget({ id: referral.id, studentName: referral.studentName });
    setCancelReason("");
    setActionError(null);
  }

  async function confirmCancel(): Promise<void> {
    if (!cancelTarget || cancelReason.trim() === "" || cancelPending) return;
    setCancelPending(true);
    setActionError(null);
    try {
      await apiClient.post(`/api/referrals/${cancelTarget.id}/cancel`, {
        reason: cancelReason.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ["myReferrals"] });
      await queryClient.invalidateQueries({ queryKey: ["referableAnecdotal"] });
      setCancelTarget(null);
      setCancelReason("");
      sileo.success({ title: "Referral cancelled", description: "The case was withdrawn." });
    } catch (err) {
      const message = apiErrorMessage(err, "Could not cancel this referral.");
      setActionError(message);
      sileo.error({ title: "Could not cancel referral", description: message });
    } finally {
      setCancelPending(false);
    }
  }

  function requestDelete(referral: { id: string; studentName: string }): void {
    setDeleteTarget({ id: referral.id, studentName: referral.studentName });
    setActionError(null);
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget || deletePending) return;
    setDeletePending(true);
    setActionError(null);
    try {
      await apiClient.delete(`/api/referrals/${deleteTarget.id}`);
      const deletedId = deleteTarget.id;
      await queryClient.invalidateQueries({ queryKey: ["myReferrals"] });
      await queryClient.invalidateQueries({ queryKey: ["referableAnecdotal"] });
      // Move selection off the deleted row so the canvas never shows it.
      setSelectedId((prev) => {
        if (prev !== deletedId) return prev;
        const next = visible.find((r) => r.id !== deletedId) ?? null;
        return next ? next.id : null;
      });
      setDeleteTarget(null);
      sileo.success({ title: "Referral deleted", description: "The case was removed from your list." });
    } catch (err) {
      const message = apiErrorMessage(err, "Could not delete this referral.");
      setActionError(message);
      sileo.error({ title: "Could not delete referral", description: message });
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <section className={styles.page}>
      <div className={styles.layout}>
        <ReferralsSidebar
          referrals={referralsData}
          selectedId={selectedId}
          onSelect={handleSelect}
          onNew={handleNewReferral}
          query={query}
          onQueryChange={setQuery}
          trackFilter={trackFilter}
          onTrackFilterChange={setTrackFilter}
        />
        <div className={styles.body}>
          {creating ? (
            <div className={styles.workspace}>
              {isComposerLoading ? (
                <div className={styles.skelCanvas} aria-busy="true" aria-label="Loading referable records">
                  <div className={styles.skelCanvasHead}>
                    <div className={styles.skelCanvasId}>
                      <Skeleton className={styles.skelCanvasTitle} />
                      <Skeleton className={styles.skelCanvasSub} />
                    </div>
                    <Skeleton className={styles.skelCanvasBadge} />
                  </div>
                  <div className={styles.skelNodes}>
                    <Skeleton className={styles.skelNode} />
                    <Skeleton className={styles.skelNode} />
                    <Skeleton className={styles.skelNode} />
                    <Skeleton className={styles.skelNode} />
                  </div>
                  <div className={styles.skelCaseFile}>
                    <Skeleton className={styles.skelCaseCellWide} />
                    <Skeleton className={styles.skelCaseCellNarrow} />
                  </div>
                </div>
              ) : (
                <ReferralComposer
                  referables={referablesData}
                  admActiveLrns={admActiveLrns}
                  onCancel={() => setCreating(false)}
                  onCreate={handleCreateReferral}
                  onCreated={handleCreated}
                />
              )}
            </div>
          ) : referralsData.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>No referrals yet</p>
              <p className={styles.emptyBody}>
                Refer from one of your anecdotal records to open your first case.
              </p>
              <button type="button" className={styles.emptyAction} onClick={() => setCreating(true)}>
                New referral
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>No matches</p>
              <p className={styles.emptyBody}>
                {needle
                  ? `No referrals match "${query.trim()}".`
                  : "No referrals match the selected filters."}
              </p>
            </div>
          ) : (
            <div className={styles.workspace}>
              <ReferralCanvas
                referral={canvasVisible}
                onCancelRequest={requestCancel}
                onDeleteRequest={requestDelete}
              />
            </div>
          )}
        </div>
      </div>

      <ReferralCancelDialog
        target={cancelTarget}
        reason={cancelReason}
        onReasonChange={setCancelReason}
        pending={cancelPending}
        error={actionError}
        onClose={() => {
          if (!cancelPending) {
            setCancelTarget(null);
            setActionError(null);
          }
        }}
        onConfirm={confirmCancel}
      />
      <ReferralDeleteDialog
        target={deleteTarget}
        pending={deletePending}
        error={actionError}
        onClose={() => {
          if (!deletePending) {
            setDeleteTarget(null);
            setActionError(null);
          }
        }}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
