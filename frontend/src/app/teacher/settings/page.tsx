"use client";

import * as React from "react";
import { Dock, Loader2, Moon, PanelLeft, Sun } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import BranchedMenu from "@/components/nav/BranchedMenu";
import { useLinksLayout } from "@/lib/links-layout";
import {
  BranchedNav,
  scrollToSection,
  settingsSections,
} from "./components/SettingsNav";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { useFont, useTheme } from "@/components/providers";
import { toast } from "@/components/ui/sonner";
import {
  teacherOverviewKey,
  useCachedMasterTeacher,
  useTeacherOverview,
  type TeacherOverviewCritical,
  writeCachedMasterTeacher,
} from "../overview/components/teacher-overview-data";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.replace(/^[^A-Za-z]+/, "")?.[0] ?? parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : (parts[0]?.[1] ?? "");
  return `${first}${last}`.toUpperCase();
}

function roleLabel(role: string | undefined): string {
  if (role === "adviser") return "Adviser";
  if (role === "subject_teacher") return "Subject Teacher";
  return "Teacher";
}

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
    <section id="section-password" aria-labelledby="settings-password" className="scroll-mt-24 rounded-xl border border-input bg-card p-5 shadow-sm">
      <h2 id="settings-password" className="text-base font-semibold">
        Password
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose a new password at least 8 characters long.
      </p>
      <form onSubmit={(e) => void handleSave(e)} className="mt-4 max-w-sm space-y-4">
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

export default function TeacherSettingsPage() {
  const session = useSession();
  const { theme, setTheme } = useTheme();
  const { font, setFont } = useFont();
  const overview = useTeacherOverview();
  const queryClient = useQueryClient();

  const isDark = theme === "dark";
  // Hydration-safe first-frame value — a direct localStorage read here would
  // mismatch the server render for a teacher who already enabled the toggle.
  const cachedMaster = useCachedMasterTeacher(session?.sub);
  const isMasterTeacher = overview.data?.isMasterTeacher ?? cachedMaster;
  const masterTeacherEligible = overview.data?.masterTeacherEligible ?? false;
  const [mtLoading, setMtLoading] = React.useState(false);
  const [linksLayout, setLinksLayout] = useLinksLayout();
  const links = settingsSections(masterTeacherEligible);
  const [activeSection, setActiveSection] = React.useState(links[0]?.id ?? "section-profile");

  const handleSelectSection = (id: string) => {
    setActiveSection(id);
    scrollToSection(id);
  };

  const handleToggleMasterTeacher = async () => {
    if (mtLoading) return;
    const next = !isMasterTeacher;
    setMtLoading(true);
    queryClient.setQueryData(teacherOverviewKey(session?.sub), (old: TeacherOverviewCritical | undefined) => {
      if (!old) return old;
      return { ...old, isMasterTeacher: next };
    });
    try {
      await apiClient.patch("/api/teacher/settings/master-teacher", { isMasterTeacher: next });
      // Mirror to the refresh-proof cache so the nav tab and schedule gate
      // survive a hard refresh without a flash. Authoritative refetch last.
      writeCachedMasterTeacher(session?.sub, next);
      await queryClient.invalidateQueries({ queryKey: teacherOverviewKey(session?.sub) });
      toast.success({
        title: next ? "Master Teacher enabled" : "Master Teacher disabled",
        description: next
          ? "Your classes now appear under the Master Teacher designation."
          : "You no longer have the Master Teacher designation.",
      });
    } catch (err) {
      queryClient.setQueryData(teacherOverviewKey(session?.sub), (old: TeacherOverviewCritical | undefined) => {
        if (!old) return old;
        return { ...old, isMasterTeacher: isMasterTeacher };
      });
      writeCachedMasterTeacher(session?.sub, isMasterTeacher);
      const message = getErrorMessage(err, "Failed to update Master Teacher status.");
      toast.error({ title: "Could not update status", description: message });
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

      <section aria-labelledby="settings-navigation" className="rounded-xl border border-input bg-card p-5 shadow-sm">
        <h2 id="settings-navigation" className="text-base font-semibold">
          Links layout
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how the section links appear on this page.
        </p>
        <div className="mt-4 flex gap-2" role="radiogroup" aria-label="Links layout">
          <Button
            type="button"
            variant={linksLayout === "sidebar" ? "default" : "outline"}
            role="radio"
            aria-checked={linksLayout === "sidebar"}
            onClick={() => setLinksLayout("sidebar")}
            className="flex-1"
          >
            <PanelLeft size={16} aria-hidden />
            Sidebar
          </Button>
          <Button
            type="button"
            variant={linksLayout === "navbar" ? "default" : "outline"}
            role="radio"
            aria-checked={linksLayout === "navbar"}
            onClick={() => setLinksLayout("navbar")}
            className="flex-1"
          >
            <Dock size={16} aria-hidden />
            Navbar
          </Button>
        </div>
      </section>

      <div className={linksLayout === "sidebar" ? "grid items-start gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]" : "flex flex-col gap-5"}>
        <div className="lg:sticky lg:top-24">
          {linksLayout === "sidebar" ? (
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
          ) : (
            <BranchedNav links={links} activeId={activeSection} onSelect={handleSelectSection} />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-5">
      <section id="section-profile" aria-labelledby="settings-profile" className="scroll-mt-24 rounded-xl border border-input bg-card p-5 shadow-sm">
        <h2 id="settings-profile" className="text-base font-semibold">
          Profile
        </h2>
        {overview.isPending ? (
          <div className="mt-4 flex items-center gap-4">
            <Skeleton className="size-12 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
        ) : overview.isError || !overview.data ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            Could not load your profile.
          </p>
        ) : (
          <div className="mt-4 flex items-center gap-4">
            <span
              aria-hidden
              className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground"
            >
              {initialsOf(overview.data.teacherName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{overview.data.teacherName}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {roleLabel(session?.role)}
                {" · "}
                {overview.data.advisorySection
                  ? `Adviser of ${overview.data.advisorySection.name}`
                  : "No advisory section"}
                {" · "}
                {overview.data.kpi.classCount} class{overview.data.kpi.classCount === 1 ? "" : "es"}
              </p>
            </div>
          </div>
        )}
      </section>

      {masterTeacherEligible ? (
        <section id="section-master-teacher" aria-labelledby="settings-master-teacher" className="scroll-mt-24 rounded-xl border border-input bg-card p-5 shadow-sm">
          <h2 id="settings-master-teacher" className="text-base font-semibold">
            Master Teacher
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Self-declared designation for grades 7–10 classes.
          </p>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Master Teacher status</p>
              <p className="text-xs text-muted-foreground">
                {isMasterTeacher ? "Currently designated" : "Not designated"}
              </p>
            </div>
            <Switch
              checked={isMasterTeacher}
              onCheckedChange={handleToggleMasterTeacher}
              disabled={mtLoading}
              aria-label="Toggle Master Teacher status"
            />
          </div>
        </section>
      ) : null}

      <section id="section-appearance" aria-labelledby="settings-appearance" className="scroll-mt-24 rounded-xl border border-input bg-card p-5 shadow-sm">
        <h2 id="settings-appearance" className="text-base font-semibold">
          Appearance
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Applies instantly across the whole workspace.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
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
                <Sun size={16} aria-hidden />
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
                <Moon size={16} aria-hidden />
                Dark
              </Button>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Font</p>
            <div className="flex gap-2" role="radiogroup" aria-label="Font">
              <Button
                type="button"
                variant={font === "inter" ? "default" : "outline"}
                role="radio"
                aria-checked={font === "inter"}
                onClick={() => setFont("inter")}
                className="flex-1"
              >
                Inter
              </Button>
              <Button
                type="button"
                variant={font === "nunito" ? "default" : "outline"}
                role="radio"
                aria-checked={font === "nunito"}
                onClick={() => setFont("nunito")}
                className="flex-1"
              >
                Nunito
              </Button>
            </div>
          </div>
        </div>
      </section>

      <PasswordCard />
        </div>
      </div>
    </section>
  );
}
