"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import BranchedMenu from "@/components/nav/BranchedMenu";
import { scrollToSection, settingsSections } from "./components/SettingsNav";
import { ProfileCard } from "./components/ProfileCard";
import { PaletteCard } from "./components/PaletteCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { useTheme } from "@/components/providers";
import { toast } from "@/components/ui/sonner";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { useCachedMasterTeacher } from "@/services/teacher/flagCache";
import { useTeacherOverview } from "@/services/teacher/overview.service";
import { useTeacherInvalidate } from "../components/use-teacher-invalidate";

function getErrorMessage(err: unknown, fallback: string): string {
  // The backend envelopes errors as { error: { code, message } } — read that
  // first so users see the real reason instead of axios's raw status text.
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function PasswordCard() {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await apiClient.post("/api/auth/change-password", {
        currentPassword: current,
        newPassword: next,
      });
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success({ title: "Password updated", description: "Use your new password next time you sign in." });
    } catch (err) {
      const message = getErrorMessage(err, "Failed to update password.");
      setError(message);
      toast.error({ title: "Could not update password", description: message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="section-password" aria-labelledby="settings-password" className={`${assign.card} scroll-mt-24`}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <h2 id="settings-password" className="relative text-base font-semibold">
        Password
      </h2>
      <p className="relative mt-1 text-sm text-muted-foreground">
        Choose a new password at least 8 characters long.
      </p>
      <form onSubmit={(e) => void handleSave(e)} className="relative mt-4 max-w-sm space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="settings-current">Current password</Label>
          <Input
            id="settings-current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => {
              setCurrent(e.target.value);
              setError(null);
            }}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-new">New password</Label>
          <Input
            id="settings-new"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => {
              setNext(e.target.value);
              setError(null);
            }}
            required
            minLength={8}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-confirm">Confirm new password</Label>
          <Input
            id="settings-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setError(null);
            }}
            required
            minLength={8}
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={saving} aria-busy={saving || undefined}>
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden />
              <span aria-live="polite">Saving…</span>
            </>
          ) : (
            "Update password"
          )}
        </Button>
      </form>
    </section>
  );
}

type AdviserSectionOption = {
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

function AdviserCard() {
  const overview = useTeacherOverview();
  const isAdviser = overview.data?.isAdviser ?? false;
  const advisorySection = overview.data?.advisorySection ?? null;
  const [picking, setPicking] = React.useState(false);
  const [answeredNo, setAnsweredNo] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const sectionsQuery = useQuery<{ sections: AdviserSectionOption[] }>({
    queryKey: ["teacher-settings-adviser-sections"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ sections: AdviserSectionOption[] }>(
        "/api/teacher/settings/adviser-sections",
      );
      return data;
    },
    staleTime: 30_000,
  });

  const sections = sectionsQuery.data?.sections ?? [];
  const mine = sections.filter((s) => s.advisedByMe);
  const currentName = mine[0]?.name ?? advisorySection?.name ?? null;
  // Picker prefers sections already in the master teacher's schedule, then
  // grade, then name. Taken sections stay visible but disabled.
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
      // Single-section model: release any previous section after the new
      // claim lands, so a failed claim never leaves the teacher seatless.
      // Released in parallel — typically 1 seat, but never sequential.
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
                {saving ? "Working…" : "I'm not an adviser"}
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

function AdviserPicker({
  ordered,
  loading,
  loadError,
  effectiveSelected,
  saving,
  code,
  codeRequired,
  onCodeChange,
  onSelect,
  onClaim,
}: {
  ordered: AdviserSectionOption[];
  loading: boolean;
  loadError: boolean;
  effectiveSelected: string | null;
  saving: boolean;
  code: string;
  codeRequired: boolean;
  onCodeChange: (v: string) => void;
  onSelect: (id: string) => void;
  onClaim: () => void;
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground" aria-busy="true">Loading sections…</p>;
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

export default function TeacherSettingsPage() {
  const session = useSession();
  const { theme, setTheme } = useTheme();
  const overview = useTeacherOverview();
  const invalidateTeacher = useTeacherInvalidate();

  const isDark = theme === "dark";
  // Hydration-safe first-frame value — a direct localStorage read here would
  // mismatch the server render for a teacher who already enabled the toggle.
  const cachedMaster = useCachedMasterTeacher(session?.sub);
  const isMasterTeacher = overview.data?.isMasterTeacher ?? cachedMaster;
  const masterTeacherEligible = overview.data?.masterTeacherEligible ?? false;
  // Singleton seat: when another active teacher holds the designation, this
  // login must not be prompted to claim it — the toggle hides until release.
  const masterTeacherTaken = overview.data?.masterTeacherTaken ?? false;
  const masterHolderName = overview.data?.masterTeacherHolderName ?? null;
  const takenByOther = !isMasterTeacher && masterTeacherTaken;
  const [mtLoading, setMtLoading] = React.useState(false);
  const links = settingsSections(masterTeacherEligible);
  const [activeSection, setActiveSection] = React.useState(links[0]?.id ?? "section-profile");

  const handleSelectSection = (id: string) => {
    setActiveSection(id);
    scrollToSection(id);
  };

  const handleToggleMasterTeacher = async () => {
    if (mtLoading) return;
    const next = !isMasterTeacher;
    // Local guard: never attempt a steal while another master holds the seat.
    // The backend also rejects with 409 MASTER_TEACHER_TAKEN as backstop.
    if (next && takenByOther) {
      toast.error({
        title: "Designation unavailable",
        description: masterHolderName
          ? `Master Teacher is currently designated by ${masterHolderName} — try again after it is turned off.`
          : "Master Teacher is currently designated — try again after it is turned off.",
      });
      return;
    }
    setMtLoading(true);
    try {
      await apiClient.patch("/api/teacher/settings/master-teacher", { isMasterTeacher: next });
      // Pessimistic: the toggle flips only after the server confirms; the
      // settled refetch below repaints nav, schedule gates, and holder info.
      invalidateTeacher.settings();
      toast.success({
        title: next ? "Master Teacher enabled" : "Master Teacher disabled",
        description: next
          ? "Your classes now appear under the Master Teacher designation."
          : "You no longer have the Master Teacher designation.",
      });
    } catch (err) {
      const message = getErrorMessage(err, "Failed to update Master Teacher status.");
      toast.error({ title: "Could not update status", description: message });
      // A 409 means the seat was just taken elsewhere — refresh holder info
      // so the toggle hides instead of staying actionable.
      invalidateTeacher.settings();
    } finally {
      setMtLoading(false);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your profile, appearance, and account security.
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-24">
          <BranchedMenu
            items={[
              {
                label: "Settings",
                children: links.map((l) => ({
                  value: l.id,
                  label: l.label,
                  icon: <l.Icon size={16} strokeWidth={1.8} aria-hidden="true" />,
                })),
              },
            ]}
            defaultOpen={[0]}
            defaultActive={activeSection}
            onSelect={(value) => handleSelectSection(value)}
            width={240}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
      <ProfileCard />

      <AdviserCard />

      {masterTeacherEligible ? (
        <section id="section-master-teacher" aria-labelledby="settings-master-teacher" className={`${assign.card} scroll-mt-24`}>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <h2 id="settings-master-teacher" className="relative text-base font-semibold">
            Master Teacher
          </h2>
          <p className="relative mt-1 text-sm text-muted-foreground">
            Self-declared designation for grades 7–10 classes.
          </p>
          {isMasterTeacher ? (
            <div className="relative mt-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Master Teacher status</p>
                <p className="text-xs text-muted-foreground">
                  Currently designated — only one designation at a time.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  No teacher code is needed on My Classes / Attendance while designated —
                  your student and subject records open directly. Turn off to release the seat.
                </p>
              </div>
              <Switch
                checked
                onCheckedChange={handleToggleMasterTeacher}
                disabled={mtLoading}
                aria-label="Toggle Master Teacher status"
              />
            </div>
          ) : takenByOther ? (
            <div className="relative mt-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Master Teacher status</p>
                <p className="text-xs text-muted-foreground">
                  {masterHolderName
                    ? `Currently designated by ${masterHolderName} — unavailable until released.`
                    : "Currently designated — unavailable until released."}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Enter the code from the master teacher&apos;s teacher list on My Classes /
                  Attendance to attach your student and subject records.
                </p>
              </div>
              {/* No prompt for others while the seat is taken: switch hidden
                  until the holder turns it off again. */}
            </div>
          ) : (
            <div className="relative mt-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Master Teacher status</p>
                <p className="text-xs text-muted-foreground">Not designated</p>
              </div>
              <Switch
                checked={false}
                onCheckedChange={handleToggleMasterTeacher}
                disabled={mtLoading}
                aria-label="Toggle Master Teacher status"
              />
            </div>
          )}
        </section>
      ) : null}

      <section id="section-appearance" aria-labelledby="settings-appearance" className={`${assign.card} scroll-mt-24`}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <h2 id="settings-appearance" className="relative text-base font-semibold">
          Appearance
        </h2>
        <p className="relative mt-1 text-sm text-muted-foreground">
          Applies instantly across the whole workspace.
        </p>
        <div className="relative mt-4">
          <p className="mb-2 text-sm font-medium">Theme</p>
          <div className="flex gap-2" role="radiogroup" aria-label="Theme">
            <Button
              type="button"
              variant={!isDark ? "default" : "outline"}
              role="radio"
              aria-checked={!isDark}
              onClick={() => setTheme("light")}
              className="flex-1"
            >
              Light
            </Button>
            <Button
              type="button"
              variant={isDark ? "default" : "outline"}
              role="radio"
              aria-checked={isDark}
              onClick={() => setTheme("dark")}
              className="flex-1"
            >
              Dark
            </Button>
          </div>
        </div>
      </section>

      <PaletteCard />

      <PasswordCard />
        </div>
      </div>
    </section>
  );
}
