"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { StudentMascot, MASCOT_CHARACTERS } from "@/components/student-mascot/StudentMascot";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { roleLabel } from "@/lib/auth/roles";
import { toast } from "@/components/ui/sonner";
import { useDock } from "@/components/dock/dock-store";
import sectionStyles from "./settings-section.module.css";
import {
  nurseProfileSettingsKey,
  useNurseProfileSettings,
  type NurseProfileSettings,
} from "@/services/settings/profile-settings";

function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function ProfileCard() {
  const session = useSession();
  const queryClient = useQueryClient();
  const dock = useDock();
  const profile = useNurseProfileSettings();
  const profileKey = nurseProfileSettingsKey(session?.sub);

  const [name, setName] = React.useState("");
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [mascotError, setMascotError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [mascot, setMascot] = React.useState<string | null>(null);

  const savedName = profile.data?.fullName ?? "";
  const savedMascot = profile.data?.mascot ?? null;

  const [prevSavedName, setPrevSavedName] = React.useState<string | null>(null);
  if (prevSavedName !== savedName) {
    setPrevSavedName(savedName);
    setName(savedName);
  }

  const [prevSavedMascot, setPrevSavedMascot] = React.useState<string | null | undefined>(undefined);
  if (prevSavedMascot !== savedMascot) {
    setPrevSavedMascot(savedMascot);
    setMascot(savedMascot);
  }

  const displayName = savedName;
  const band = session?.gradeBand ?? null;
  const bandLabel = band === "7-10" ? "Grades 7–10" : band === "11-12" ? "Grades 11–12" : null;
  const nameDirty = name.trim() !== "" && name.trim() !== savedName;
  const mascotDirty = (mascot ?? null) !== savedMascot;
  const dirty = nameDirty || mascotDirty;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: profileKey });
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !dirty) return;
    if (nameDirty && name.trim().length < 1) {
      setNameError("Name cannot be empty.");
      return;
    }
    setNameError(null);
    setMascotError(null);
    setSaving(true);
    // The shared Dock in the bottom-right reports the save until it settles.
    let taskId: string | null = null;
    try {
      taskId = dock.startTask({
        kind: "generic",
        title: "Saving profile",
        description: nameDirty
          ? `${name.trim()} → display name`
          : `Mascot → ${mascot ?? "none"}`,
      });
    } catch {
      taskId = null;
    }
    // Optimistic: topbar avatar + shell header update instantly,
    // rollback on failure.
    const previous = queryClient.getQueryData<NurseProfileSettings>(profileKey);
    queryClient.setQueryData<NurseProfileSettings>(profileKey, (old) => ({
      fullName: nameDirty ? name.trim() : (old?.fullName ?? savedName),
      photoUrl: old?.photoUrl ?? profile.data?.photoUrl ?? null,
      mascot: mascotDirty ? mascot : (old?.mascot ?? savedMascot),
      primaryColor: old?.primaryColor ?? profile.data?.primaryColor ?? null,
      secondaryColor: old?.secondaryColor ?? profile.data?.secondaryColor ?? null,
    }));
    try {
      await apiClient.patch("/api/nurse/settings/profile", {
        ...(nameDirty ? { fullName: name.trim() } : {}),
        ...(mascotDirty ? { mascot } : {}),
      });

      refresh();
      if (taskId) dock.completeTask(taskId, "Profile saved.");
      toast.success({ title: "Profile updated", description: "Your mascot and display name were saved." });
    } catch (err) {
      queryClient.setQueryData(profileKey, previous);
      const message = getErrorMessage(err, "Could not update your profile.");
      if (taskId) dock.failTask(taskId, message);
      if (mascotDirty && !nameDirty) {
        setMascotError(message);
      } else {
        setNameError(message);
      }
      toast.error({ title: "Could not update profile", description: message });
    } finally {
      setSaving(false);
    }
  }

  // Profile (fast, single row) renders immediately — the page gates on it.
  const loading = profile.isPending;
  const loadError = profile.isError;

  const mascotSeed = session?.sub ?? displayName;

  return (
    <div id="section-profile" className={sectionStyles.boardWrap}>
      <form onSubmit={(e) => void handleSave(e)}>
        <KanbanBoard
          title="Profile"
          icon={<UserRound size={14} aria-hidden="true" />}
          description="Your mascot and display name across the workspace."
          ariaLabel="Profile settings"
          footer={
            loading || loadError ? null : (
              <div className="flex justify-end px-1 pb-1">
                <Button type="submit" disabled={saving || !dirty} aria-busy={saving || undefined} className={sectionStyles.btn}>
                  {saving ? (
                    <>
                      <Loader2 size={12} className="animate-spin" aria-hidden />
                      <span aria-live="polite">Saving…</span>
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            )
          }
        >
          {loading ? (
            <div className="flex items-center gap-4 px-1" aria-busy="true" aria-label="Loading profile">
              <Skeleton className="size-16 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
              </div>
            </div>
          ) : loadError ? (
            <p role="alert" className="px-1 text-sm text-destructive">
              Could not load your profile.
            </p>
          ) : (
            <div className="flex flex-col gap-3 px-1">
              <div className="flex items-center gap-4">
                <span className="shrink-0 overflow-hidden rounded-2xl border border-amber-500/40 bg-muted/40 shadow-sm">
                  <StudentMascot
                    name={displayName || "You"}
                    seed={mascotSeed}
                    character={mascot ?? undefined}
                    size={120}
                  />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{displayName || "Nurse"}</p>
                  <div className={`mt-1.5 flex flex-wrap gap-1.5 ${sectionStyles.pills}`}>
                    <span className={sectionStyles.pill}>{roleLabel(session?.role ?? "")}</span>
                    {bandLabel ? <span className={sectionStyles.pill}>{bandLabel}</span> : null}
                  </div>
                </div>
              </div>
              <div className="max-w-sm space-y-1.5">
                <Label htmlFor="settings-display-name">Display name</Label>
                <Input
                  id="settings-display-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameError(null);
                  }}
                  placeholder="Your full name"
                  maxLength={100}
                  className="w-full"
                />
              </div>
              {nameError ? (
                <p role="alert" className={`text-sm text-destructive ${sectionStyles.reveal}`}>
                  {nameError}
                </p>
              ) : null}
              <div>
                <p id="settings-mascot-label" className="mb-2 text-sm font-medium">
                  Select your mascot
                </p>
                <div
                  className={sectionStyles.mascotGrid}
                  role="radiogroup"
                  aria-labelledby="settings-mascot-label"
                >
                  {MASCOT_CHARACTERS.map((character) => {
                    const active = mascot === character;
                    return (
                      <button
                        key={character}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={`Mascot ${character}`}
                        onClick={() => {
                          setMascot(character);
                          setMascotError(null);
                        }}
                        className={`${sectionStyles.mascotOption} ${active ? sectionStyles.mascotOptionActive : ""}`}
                      >
                        <StudentMascot
                          name={displayName || "You"}
                          seed={mascotSeed}
                          character={character}
                          size={76}
                        />
                        <span className={sectionStyles.mascotName}>{character}</span>
                      </button>
                    );
                  })}
                </div>
                <p className={`mt-1.5 text-xs text-muted-foreground ${mascotDirty && !saving ? sectionStyles.reveal : ""}`}>
                  {mascotDirty && !saving ? "Unsaved mascot — press Save. " : ""}
                  Your mascot shows across your workspace.
                </p>
              </div>
              {mascotError ? (
                <p role="alert" className={`text-sm text-destructive ${sectionStyles.reveal}`}>
                  {mascotError}
                </p>
              ) : null}
            </div>
          )}
        </KanbanBoard>
      </form>
    </div>
  );
}
