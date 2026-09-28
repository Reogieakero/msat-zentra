"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { useTerm } from "@/lib/term/TermContext";
import { toast } from "@/components/ui/sonner";

type ClaimableSection = {
  id: string;
  name: string;
  gradeLevel: number;
  adviserLabel: string;
  /** Principal's listed name matches this account — shown first. */
  suggested: boolean;
};

type AdvisedSection = {
  id: string;
  name: string;
  gradeLevel: number;
  schoolYearId: string;
};

type ClaimStatus = {
  alreadyAdvising: AdvisedSection[];
  claimable: ClaimableSection[];
};

async function fetchClaimStatus(): Promise<ClaimStatus> {
  const { data } = await apiClient.get<ClaimStatus>("/api/teacher/advisory/claim-status");
  return { alreadyAdvising: data.alreadyAdvising ?? [], claimable: data.claimable ?? [] };
}

function dismissalKey(userId: string, schoolYearId: string): string {
  return `zentra.adviserClaim.${userId}.${schoolYearId}`;
}

function isDismissed(userId: string, schoolYearId: string): boolean {
  try {
    return window.localStorage.getItem(dismissalKey(userId, schoolYearId)) === "1";
  } catch {
    return false;
  }
}

function dismiss(userId: string, schoolYearId: string): void {
  try {
    window.localStorage.setItem(dismissalKey(userId, schoolYearId), "1");
  } catch {
    /* ignore storage failures */
  }
}

// First-login adviser self-onboarding. Shows once per school year while the
// teacher advises nothing: step 1 asks "Are you an adviser?" — No dismisses
// to the workspace; Yes lists sections the principal filed under the
// teacher's name, and picking one links the account as section adviser.
// Teachers already linked never see this; a "No" re-asks only while they
// still advise nothing (e.g. next login), which is exactly when the question
// is still relevant.
export function AdviserClaimGate() {
  const session = useSession();
  const queryClient = useQueryClient();
  const { activeTerm, promptRequired } = useTerm();
  const [step, setStep] = React.useState<"ask" | "pick">("ask");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<{ year: string; message: string } | null>(null);
  const [saving, setSaving] = React.useState(false);
  // Dismissals are per school year — a new year re-arms the prompt.
  const [dismissedYear, setDismissedYear] = React.useState<string | null>(null);

  const isTeacher = session?.role === "subject_teacher" || session?.role === "adviser";
  const schoolYearId = activeTerm?.schoolYearId ?? "";
  // The term picker overlay takes precedence — only ask once a term is set.
  const gateOn =
    !!isTeacher && !!session && !!schoolYearId && !promptRequired && dismissedYear !== schoolYearId;

  const statusQuery = useQuery({
    queryKey: ["teacher", "advisory", "claim-status", schoolYearId],
    queryFn: fetchClaimStatus,
    enabled: gateOn && !isDismissed(session?.sub ?? "", schoolYearId),
    staleTime: 30_000,
    retry: 1,
  });

  const status = statusQuery.data;
  const userId = session?.sub ?? "";

  // Already advising → treat as done for this year (write-through so the
  // next mount short-circuits on the stored flag without fetching).
  if (status && status.alreadyAdvising.length > 0 && userId && schoolYearId) {
    if (!isDismissed(userId, schoolYearId)) dismiss(userId, schoolYearId);
  }
  const done = dismissedYear === schoolYearId || (status?.alreadyAdvising.length ?? 0) > 0;

  if (!gateOn) return null;
  if (!userId || isDismissed(userId, schoolYearId)) return null;
  if (statusQuery.isPending || statusQuery.isError || !status) return null;
  if (done) return null;

  // A term switch mid-pick must not carry a stale selection or error.
  const effectiveSelected = status.claimable.some((s) => s.id === selectedId) ? selectedId : null;
  const visibleError = error?.year === schoolYearId ? error.message : null;

  const handleNo = () => {
    dismiss(userId, schoolYearId);
    setDismissedYear(schoolYearId);
  };

  const handleSave = () => {
    if (!effectiveSelected || saving) return;
    const section = status.claimable.find((s) => s.id === effectiveSelected);
    if (!section) return;
    const sectionId = effectiveSelected;
    const year = schoolYearId;
    const sectionName = section.name;
    const sectionGrade = section.gradeLevel;
    setError(null);
    setSaving(true);
    // Instant: close the gate in the same tick — the claim confirms in the
    // background and advisory surfaces refresh from the response.
    dismiss(userId, year);
    setDismissedYear(year);
    void (async () => {
      try {
        await apiClient.post("/api/teacher/advisory/claim", { sectionId });
        // Patch the status cache instantly: claimed section moves to advised.
        const statusKey = ["teacher", "advisory", "claim-status", year];
        queryClient.setQueryData<ClaimStatus>(statusKey, (prev) => {
          if (!prev) return prev;
          const claimed = prev.claimable.find((s) => s.id === sectionId);
          if (!claimed) return prev;
          return {
            alreadyAdvising: [
              ...prev.alreadyAdvising,
              { id: claimed.id, name: claimed.name, gradeLevel: claimed.gradeLevel, schoolYearId: year },
            ],
            claimable: prev.claimable.filter((s) => s.id !== sectionId),
          };
        });
        // Advisory surfaces fetched pre-claim (the roster even 404s with
        // retry:false) must refetch now — prefixes match the scoped keys.
        for (const key of [
          ["teacher-overview"],
          ["advisory-students"],
          ["advisee-attendance"],
          ["advisee-academic"],
          ["adm-my-cases"],
          ["grade-flags"],
        ]) {
          void queryClient.invalidateQueries({ queryKey: key });
        }
        toast.success({
          title: "Advisory saved",
          description: `You are now the adviser of ${sectionName} (Grade ${sectionGrade}).`,
        });
      } catch (err) {
        // Reopen the gate on the same step with the failure reason.
        try {
          window.localStorage.removeItem(dismissalKey(userId, year));
        } catch {
          /* ignore storage failures */
        }
        setDismissedYear(null);
        // The backend envelopes errors as { error: { code, message } }.
        const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
        const serverMessage = data?.error?.message ?? data?.message;
        const message =
          typeof serverMessage === "string" && serverMessage
            ? serverMessage
            : err instanceof Error
              ? err.message
              : "Failed to save your advisory section.";
        setError({ year, message });
        toast.error({ title: "Could not save", description: message });
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Adviser setup"
      className="fixed inset-0 z-[90] overflow-y-auto bg-background"
    >
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-4 py-10">
        {step === "ask" ? (
          <>
            <h2 className="text-2xl font-semibold tracking-tight">Are you an adviser?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              First time here in <strong>{activeTerm?.schoolYearName ?? "this school year"}</strong>? Tell us
              so we can link your advisory section now — or skip and continue to your workspace.
            </p>
            <div className="mt-8 flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="lg" onClick={handleNo}>
                No, continue to workspace
              </Button>
              <Button size="lg" onClick={() => setStep("pick")}>
                Yes, I&apos;m an adviser
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-semibold tracking-tight">Select your section</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              These are the unclaimed advisory sections for{" "}
              <strong>{activeTerm?.schoolYearName ?? "this school year"}</strong>. Picking one saves
              you as its adviser — even if the listed name is misspelled, just pick your actual
              section.
            </p>
            {status.claimable.length === 0 ? (
              <p role="status" className="mt-6 rounded-xl border border-dashed border-input p-5 text-sm text-muted-foreground">
                No unclaimed sections left for {activeTerm?.schoolYearName ?? "this school year"}.
                Ask your principal to add a section first, then come back here.
              </p>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Your section">
                {status.claimable.map((s) => {
                  const selected = effectiveSelected === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setSelectedId(s.id);
                        setError(null);
                      }}
                      className={`flex min-h-24 flex-col rounded-xl border bg-card p-4 text-left shadow-sm transition-all ${
                        selected
                          ? "border-primary ring-2 ring-primary/40"
                          : "border-input hover:border-primary/50 hover:shadow"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-base font-semibold">{s.name}</span>
                        {s.suggested ? (
                          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                            Listed under you
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 text-xs font-medium text-muted-foreground">
                        Grade {s.gradeLevel}
                        {s.adviserLabel ? ` · Listed as "${s.adviserLabel}"` : ""}
                      </span>
                      <span
                        className={`mt-auto pt-3 text-xs font-semibold ${
                          selected ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {selected ? "● Selected" : "○ Select this section"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {visibleError ? (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {visibleError}
              </p>
            ) : null}
            <div className="mt-8 flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="lg" onClick={handleNo} disabled={saving}>
                Skip for now
              </Button>
              {status.claimable.length > 0 ? (
                <Button size="lg" onClick={() => void handleSave()} disabled={!effectiveSelected || saving} aria-busy={saving || undefined}>
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" aria-hidden />
                      <span aria-live="polite">Claiming…</span>
                    </>
                  ) : (
                    "Save advisory section"
                  )}
                </Button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
