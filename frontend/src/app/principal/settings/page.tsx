"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import BranchedMenu from "@/components/nav/BranchedMenu";
import { principalSettingsSections, scrollToSection } from "./components/SettingsNav";
import { ProfileCard } from "./components/ProfileCard";
import { PaletteCard } from "./components/PaletteCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api/client";
import { useTheme } from "@/components/providers";
import { toast } from "@/components/ui/sonner";
import { PrincipalPageHeader } from "../components/PrincipalPageHeader";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";

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

export default function PrincipalSettingsPage() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const links = principalSettingsSections();
  const [activeSection, setActiveSection] = React.useState(links[0]?.id ?? "section-profile");

  const handleSelectSection = (id: string) => {
    setActiveSection(id);
    scrollToSection(id);
  };

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <PrincipalPageHeader
        title="Settings"
        description="Your profile, appearance, and account security."
      />

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
