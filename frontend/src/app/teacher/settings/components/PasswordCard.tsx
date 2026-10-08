"use client";
import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
export function PasswordCard() {
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
