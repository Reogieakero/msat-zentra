"use client";

import { useEffect, useMemo, useState } from "react";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ReferralsHeader } from "./components/ReferralsHeader";
import { ReferralFilters } from "./components/ReferralFilters";
import { ReferralLibrary } from "./components/ReferralLibrary";
import { ReferralCanvas } from "./components/ReferralCanvas";
import { ReferralComposer } from "./components/ReferralComposer";
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
  status: "pending" | "in_progress" | "resolved";
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
  const [selectedId, setSelectedId] = useState<string | null>(() => readLastViewedReferralId());
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (selectedId) writeLastViewedReferralId(selectedId);
  }, [selectedId]);

  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      referralsData.filter((r) => {
        if (!needle) return true;
        return (
          r.studentName.toLowerCase().includes(needle) || r.lrn.includes(needle)
        );
      }),
    [referralsData, needle]
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
        <div className={styles.skelHeader}>
          <div className={styles.skelHeaderText}>
            <Skeleton className={styles.skelTitle} />
            <Skeleton className={styles.skelSubtitle} />
          </div>
          <Skeleton className={styles.skelAction} />
        </div>
        <hr className={styles.divider} />

        <div className={styles.body}>
          <div className={styles.toolbar}>
            <Skeleton className={styles.skelToolbarBtn} />
            <Skeleton className={styles.skelViewing} />
            <Skeleton className={styles.skelSearch} />
          </div>

          <div className={styles.workspace}>
            <div className={styles.skelCanvas}>
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
              </div>
              <div className={styles.skelCaseFile}>
                <Skeleton className={styles.skelCaseRow} />
                <Skeleton className={styles.skelCaseRowShort} />
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  function handleSelect(id: string) {
    setSelectedId(id);
    setLibraryOpen(false);
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
  }

  return (
    <section className={styles.page}>
      <ReferralsHeader referrals={referralsData} onNew={handleNewReferral} />
      <hr className={styles.divider} />

      <div className={styles.body}>
        <div className={styles.toolbar}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLibraryOpen(true)}
          >
            <PanelLeft aria-hidden />
            My referrals
            <Badge variant="secondary">{visible.length}</Badge>
          </Button>
          {creating ? (
            <span className={styles.viewing}>Answering new-referral questions</span>
          ) : (
            canvasVisible && (
              <span className={styles.viewing}>
                Viewing {canvasVisible.studentName}
              </span>
            )
          )}
          <ReferralFilters
            query={query}
            onQueryChange={setQuery}
          />
        </div>

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
                </div>
                <div className={styles.skelCaseFile}>
                  <Skeleton className={styles.skelCaseRow} />
                  <Skeleton className={styles.skelCaseRowShort} />
                </div>
              </div>
            ) : (
              <ReferralComposer
                referables={referablesData}
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
            <ReferralCanvas referral={canvasVisible} />
          </div>
        )}
      </div>

      <Sheet open={libraryOpen} onOpenChange={setLibraryOpen}>
        <SheetContent side="left" className={styles.sheet}>
          <SheetHeader>
            <SheetTitle>My referrals</SheetTitle>
            <SheetDescription>
              Open a student, then select a specific referral to view its workflow.
            </SheetDescription>
          </SheetHeader>
          <div className={styles.sheetBody}>
            <ReferralLibrary
              referrals={visible}
              selectedId={canvasVisible?.id ?? null}
              onSelect={handleSelect}
            />
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
