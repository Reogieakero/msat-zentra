"use client";
import * as React from "react";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeacherOverview } from "@/services/teacher/overview.service";
import { useTerm } from "@/lib/term/TermContext";
import { useTeacherInvalidate } from "../../components/use-teacher-invalidate";
function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
export type AdviserSectionOption = {
  id: string;
  name: string;
  gradeLevel: string;
  gradeNumber: number;
  adviserLabel: string;
  claimable: boolean;
  advisedByMe: boolean;
  holderName: string | null;
  inMasterSchedule: boolean;
  hasCode?: boolean;
};
export function useAdviserSections() {
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  return useQuery<{ sections: AdviserSectionOption[] }>({
    // Term-scoped: advisory assignments differ per school year/term.
    queryKey: ["teacher-settings-adviser-sections", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ sections: AdviserSectionOption[] }>(
        "/api/teacher/settings/adviser-sections",
      );
      return data;
    },
    staleTime: 30_000,
  });
}
export function AdviserCard() {
  const overview = useTeacherOverview();
  const isAdviser = overview.data?.isAdviser ?? false;
  const advisorySection = overview.data?.advisorySection ?? null;
  const [picking, setPicking] = React.useState(false);
  const [answeredNo, setAnsweredNo] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const sectionsQuery = useAdviserSections();
  const sections = sectionsQuery.data?.sections ?? [];
  const mine = sections.filter((s) => s.advisedByMe);
  const currentName = mine[0]?.name ?? advisorySection?.name ?? null;
  const ordered = [...sections].sort(
    (a, b) =>
      Number(b.inMasterSchedule) - Number(a.inMasterSchedule) ||
      Number(b.claimable) - Number(a.claimable) ||
      a.gradeNumber - b.gradeNumber ||
      a.name.localeCompare(b.name),
  );
  const effectiveSelected = ordered.some((s) => s.id === selectedId && (s.claimable || s.advisedByMe))
    ? selectedId
    : null;
  const invalidateTeacher = useTeacherInvalidate();
  const refreshAdvisory = async () => {
    invalidateTeacher.settings();
  };
  const selectedTarget = ordered.find((s) => s.id === effectiveSelected) ?? null;
  const codeRequired = !!selectedTarget?.hasCode || !!selectedTarget?.adviserLabel;
  const handleClaim = async () => {
    if (!effectiveSelected || saving) return;
    const target = ordered.find((s) => s.id === effectiveSelected);
    if (!target) return;
    const needsCode = !!target.hasCode || !!target.adviserLabel;
    const trimmedCode = code.trim();
    if (needsCode && !trimmedCode) {
      toast.error({
        title: "Code required",
        description: `Enter the advisory code your principal shared for ${target.name}.`,
      });
      return;
    }
    setSaving(true);
    try {
      const previousMine = mine.length > 0 ? mine.map((m) => m.id) : advisorySection ? [advisorySection.id] : [];
      await apiClient.post("/api/teacher/advisory/claim", {
        sectionId: target.id,
        ...(needsCode ? { code: trimmedCode } : {}),
      });
      await Promise.allSettled(
        previousMine
          .filter((id) => id !== target.id)
          .map((oldId) =>
            apiClient.delete(
              `/api/teacher/advisory/claim?sectionId=${encodeURIComponent(oldId)}`,
              { data: { sectionId: oldId } },
            ),
          ),
      );
      await refreshAdvisory();
      setPicking(false);
      setAnsweredNo(false);
      setSelectedId(null);
      setCode("");
      toast.success({
        title: "Advisory saved",
        description: `You are now the adviser of ${target.name}.`,
      });
    } catch (err) {
      const message = getErrorMessage(err, "Failed to save your advisory section.");
      toast.error({ title: "Could not save", description: message });
    } finally {
      setSaving(false);
    }
  };
  const handleRelease = async (sectionId: string | null) => {
    if (saving) return;
    setSaving(true);
    try {
      const url = sectionId
        ? `/api/teacher/advisory/claim?sectionId=${encodeURIComponent(sectionId)}`
        : "/api/teacher/advisory/claim";
      await apiClient.delete(url, sectionId ? { data: { sectionId } } : undefined);
      await refreshAdvisory();
      setPicking(false);
      setSelectedId(null);
      toast.success({
        title: "Advisory released",
        description: "You are no longer an adviser. Overview, Workspace and Settings stay available.",
      });
    } catch (err) {
      const message = getErrorMessage(err, "Failed to release your advisory section.");
      toast.error({ title: "Could not release", description: message });
    } finally {
      setSaving(false);
    }
  };
  return (
    <section id="section-adviser" aria-labelledby="settings-adviser" className={`${assign.card} scroll-mt-24`}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <h2 id="settings-adviser" className="relative text-base font-semibold">
        Adviser
      </h2>
      <p className="relative mt-1 text-sm text-muted-foreground">
        Are you an adviser? Pick your section and enter the advisory code your principal shared.
      </p>
      <div className="relative mt-4">
        <p className="text-sm font-medium">Adviser status</p>
        <p className="text-xs text-muted-foreground">
          {isAdviser || mine.length > 0
            ? currentName
              ? `Adviser of ${currentName}`
              : "Adviser"
            : "Not an adviser"}
        </p>
        {!isAdviser && mine.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Only Overview, Workspace and Settings show until you claim a section — the Advisory
            branch unlocks once you are an adviser.
          </p>
        ) : null}
      </div>
      {isAdviser || mine.length > 0 ? (
        <div className="relative mt-4 flex flex-col gap-3">
          {mine.length > 1 ? (
            <div className="flex flex-col gap-2">
              {mine.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-input px-3 py-2">
                  <span className="text-sm font-medium">{s.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={() => void handleRelease(s.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    Release
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setPicking((v) => !v)}
              >
                {picking ? "Close section list" : "Change section"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={saving}
                onClick={() => void handleRelease(mine[0]?.id ?? advisorySection?.id ?? null)}
                className="text-destructive hover:text-destructive"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" aria-hidden />
                    <span aria-live="polite">Saving</span>
                  </>
                ) : (
                  "I'm not an adviser"
                )}
              </Button>
            </div>
          )}
          {picking ? (
            <AdviserPicker
              ordered={ordered}
              loading={sectionsQuery.isPending}
              loadError={sectionsQuery.isError}
              effectiveSelected={effectiveSelected}
              saving={saving}
              code={code}
              codeRequired={codeRequired}
              onCodeChange={setCode}
              onSelect={(id) => setSelectedId(id)}
              onClaim={() => void handleClaim()}
            />
          ) : null}
        </div>
      ) : picking ? (
        <div className="relative mt-4 flex flex-col gap-3">
          <AdviserPicker
            ordered={ordered}
            loading={sectionsQuery.isPending}
            loadError={sectionsQuery.isError}
            effectiveSelected={effectiveSelected}
            saving={saving}
            code={code}
            codeRequired={codeRequired}
            onCodeChange={setCode}
            onSelect={(id) => setSelectedId(id)}
            onClaim={() => void handleClaim()}
          />
          <div>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setPicking(false); setSelectedId(null); }}>
              Back
            </Button>
          </div>
        </div>
      ) : answeredNo ? (
        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          <p className="w-full text-xs text-muted-foreground">
            No problem — Overview, Workspace and Settings stay available. You can claim a section any time.
          </p>
          <Button type="button" variant="outline" onClick={() => { setAnsweredNo(false); setPicking(true); }}>
            Actually, I&apos;m an adviser
          </Button>
        </div>
      ) : (
        <div className="relative mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setAnsweredNo(true)}>
            No
          </Button>
          <Button type="button" onClick={() => setPicking(true)}>
            Yes, I&apos;m an adviser
          </Button>
        </div>
      )}
    </section>
  );
}
export function AdviserPicker({ ordered, loading, loadError, effectiveSelected, saving, code, codeRequired, onCodeChange, onSelect, onClaim }: { ordered: AdviserSectionOption[]; loading: boolean; loadError: boolean; effectiveSelected: string | null; saving: boolean; code: string; codeRequired: boolean; onCodeChange: (v: string) => void; onSelect: (id: string) => void; onClaim: () => void }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading sections">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-2/3" />
      </div>
    );
  }
  if (loadError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not load sections from the master teacher&apos;s schedule.
      </p>
    );
  }
  const claimableCount = ordered.filter((s) => s.claimable || s.advisedByMe).length;
  if (claimableCount === 0) {
    return (
      <p role="status" className="rounded-xl border border-dashed border-input p-4 text-sm text-muted-foreground">
        No unclaimed sections left in the master teacher&apos;s schedule. Ask your principal to add a
        section first, then come back here.
      </p>
    );
  }
  const selectedTarget = ordered.find((s) => s.id === effectiveSelected) ?? null;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Your section">
        {ordered.map((s) => {
          const selectable = s.claimable || s.advisedByMe;
          const selected = effectiveSelected === s.id;
          const needsCode = !!s.hasCode || !!s.adviserLabel;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!selectable}
              onClick={() => onSelect(s.id)}
              className={`flex min-h-20 flex-col rounded-xl border bg-card p-3 text-left shadow-sm transition-all ${
                selected
                  ? "border-primary ring-2 ring-primary/40"
                  : selectable
                    ? "border-input hover:border-primary/50 hover:shadow"
                    : "cursor-not-allowed border-input opacity-60"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{s.name}</span>
                <span className="flex items-center gap-1">
                  {needsCode && selectable ? (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                      Code required
                    </span>
                  ) : null}
                  {s.inMasterSchedule ? (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Master schedule
                    </span>
                  ) : null}
                </span>
              </span>
              <span className="mt-1 text-[11px] font-medium text-muted-foreground">
                Grade {s.gradeNumber}
                {s.adviserLabel ? ` · Listed as "${s.adviserLabel}"` : ""}
              </span>
              <span className={`mt-auto pt-2 text-[11px] font-semibold ${selected ? "text-primary" : "text-muted-foreground"}`}>
                {!selectable && s.holderName
                  ? `Advised by ${s.holderName}`
                  : !selectable
                    ? "Already claimed"
                    : selected
                      ? "● Selected"
                      : "○ Select this section"}
              </span>
            </button>
          );
        })}
      </div>
      {selectedTarget && (selectedTarget.hasCode || selectedTarget.adviserLabel) ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-adviser-code">Advisory code</Label>
          <Input
            id="settings-adviser-code"
            value={code}
            onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
            placeholder="ADV-XXXXX"
            autoComplete="off"
            spellCheck={false}
            maxLength={16}
            style={{ textTransform: "uppercase", fontFamily: "ui-monospace, monospace" }}
          />
          <p className="text-xs text-muted-foreground">
            Ask your principal for the code for {selectedTarget.name} — it proves you are the
            listed adviser.
          </p>
        </div>
      ) : null}
      <div>
        <Button
          type="button"
          onClick={onClaim}
          disabled={!effectiveSelected || (codeRequired && !code.trim()) || saving}
          aria-busy={saving || undefined}
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden />
              <span aria-live="polite">Saving…</span>
            </>
          ) : (
            "Save advisory section"
          )}
        </Button>
      </div>
    </div>
  );
}
