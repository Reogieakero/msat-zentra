"use client";

import * as React from "react";
import { Camera, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { toast } from "@/components/ui/sonner";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { useTeacherOverview } from "@/services/teacher/overview.service";
import { useTeacherInvalidate } from "../../components/use-teacher-invalidate";
import { useTeacherProfileSettings } from "@/services/settings/profile-settings";

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
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export function ProfileCard() {
  const session = useSession();
  const invalidateTeacher = useTeacherInvalidate();
  const overview = useTeacherOverview();
  const profile = useTeacherProfileSettings();
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const [name, setName] = React.useState("");
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [nameSaving, setNameSaving] = React.useState(false);
  const [photoError, setPhotoError] = React.useState<string | null>(null);
  const [photoSaving, setPhotoSaving] = React.useState(false);

  const savedName = profile.data?.fullName ?? "";

  const [prevSavedName, setPrevSavedName] = React.useState<string | null>(null);
  if (prevSavedName !== savedName) {
    setPrevSavedName(savedName);
    setName(savedName);
  }

  const photoUrl = profile.data?.photoUrl ?? null;
  const displayName = savedName || overview.data?.teacherName || "";
  const nameDirty = name.trim() !== "" && name.trim() !== savedName;

  const refresh = () => {
    void invalidateTeacher.settings();
  };

  async function handleNameSave(e: React.FormEvent) {
    e.preventDefault();
    if (nameSaving || !nameDirty) return;
    if (name.trim().length < 1) {
      setNameError("Name cannot be empty.");
      return;
    }
    setNameError(null);
    setNameSaving(true);
    try {
      await apiClient.patch("/api/teacher/settings/profile", { fullName: name.trim() });

      refresh();
      toast.success({ title: "Name updated", description: "Your display name was saved." });
    } catch (err) {
      const message = getErrorMessage(err, "Could not update your name.");
      setNameError(message);
      toast.error({ title: "Could not update name", description: message });
    } finally {
      setNameSaving(false);
    }
  }

  function handlePhotoPick(file: File | undefined) {
    if (!file || photoSaving) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("Photo must be smaller than 2MB.");
      return;
    }
    setPhotoError(null);
    setPhotoSaving(true);
    const reader = new FileReader();
    reader.onerror = () => {
      setPhotoError("Could not read that file.");
      setPhotoSaving(false);
    };
    reader.onload = async () => {
      try {
        const dataUrl = String(reader.result ?? "");
        await apiClient.post("/api/teacher/settings/photo", { photoUrl: dataUrl });
        refresh();
        toast.success({ title: "Photo updated", description: "Your profile photo was saved." });
      } catch (err) {
        const message = getErrorMessage(err, "Could not update your photo.");
        setPhotoError(message);
        toast.error({ title: "Could not update photo", description: message });
      } finally {
        setPhotoSaving(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <section id="section-profile" aria-labelledby="settings-profile" className={`${assign.card} scroll-mt-24`}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative">
        <h2 id="settings-profile" className="text-base font-semibold">
          Profile
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your photo and display name across the workspace.
        </p>
      </div>
      {profile.isPending || overview.isPending ? (
        <div className="relative mt-1 flex items-center gap-4" aria-busy="true" aria-label="Loading profile">
          <Skeleton className="size-16 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
      ) : profile.isError || overview.isError || !overview.data ? (
        <p role="alert" className="relative text-sm text-destructive">
          Could not load your profile.
        </p>
      ) : (
        <>
          <div className="relative flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label={photoUrl ? "Change profile photo" : "Upload profile photo"}
              className="group relative shrink-0 rounded-full"
            >
              <Avatar className="size-16">
                {photoUrl ? <AvatarImage src={photoUrl} alt={displayName} /> : null}
                <AvatarFallback className="bg-primary text-lg font-bold text-primary-foreground">
                  {initialsOf(displayName)}
                </AvatarFallback>
              </Avatar>
              <span
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                {photoSaving ? (
                  <Loader2 size={20} className="animate-spin text-white" />
                ) : (
                  <Camera size={20} className="text-white" />
                )}
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              aria-label="Profile photo file"
              className="sr-only"
              onChange={(e) => handlePhotoPick(e.target.files?.[0])}
            />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{displayName}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {roleLabel(session?.role)}
                {" · "}
                {overview.data.advisorySection
                  ? `Adviser of ${overview.data.advisorySection.name}`
                  : "No advisory section"}
                {" · "}
                {overview.data.kpi.classCount} class{overview.data.kpi.classCount === 1 ? "" : "es"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Select the photo to replace it (image, up to 2MB).
              </p>
            </div>
          </div>
          {photoError ? (
            <p role="alert" className="relative text-sm text-destructive">
              {photoError}
            </p>
          ) : null}
          <form onSubmit={(e) => void handleNameSave(e)} className="relative max-w-sm space-y-2">
            <div className="space-y-1.5">
              <Label htmlFor="settings-display-name">Display name</Label>
              <div className="flex gap-2">
                <Input
                  id="settings-display-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameError(null);
                  }}
                  placeholder="Your full name"
                  maxLength={100}
                  className="min-w-0 flex-1"
                />
                <Button type="submit" disabled={nameSaving || !nameDirty} aria-busy={nameSaving || undefined}>
                  {nameSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" aria-hidden />
                      <span aria-live="polite">Saving…</span>
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </div>
            {nameError ? (
              <p role="alert" className="text-sm text-destructive">
                {nameError}
              </p>
            ) : null}
          </form>
        </>
      )}
    </section>
  );
}
