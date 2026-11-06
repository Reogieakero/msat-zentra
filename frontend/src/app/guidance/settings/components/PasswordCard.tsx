"use client";
import * as React from "react";
import { Check, CircleAlert, CircleCheck, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { useDock } from "@/components/dock/dock-store";
import sectionStyles from "./settings-section.module.css";
function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
const SECURITY_TIPS = [
  "At least 8 characters long",
  "Mix letters and numbers",
  "Don't reuse passwords from other sites",
  "You'll sign in with the new password next time",
];
function PasswordField({
  id,
  label,
  value,
  autoComplete,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  autoComplete: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={8}
          className="w-full pr-9"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          title={visible ? "Hide password" : "Show password"}
          className={sectionStyles.eyeButton}
        >
          {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
export function PasswordCard() {
  const dock = useDock();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  // Real-time feedback: validates as the user types, before submit.
  const liveError =
    confirm.length > 0 && next !== confirm
      ? "New passwords do not match."
      : next.length > 0 && next.length < 8
        ? "New password must be at least 8 characters."
        : null;
  const matchOk = next.length >= 8 && confirm.length > 0 && next === confirm;
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (liveError) {
      setError(liveError);
      return;
    }
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
    // The shared Dock in the bottom-right reports the update until it settles.
    let taskId: string | null = null;
    try {
      taskId = dock.startTask({
        kind: "generic",
        title: "Updating password",
        description: "Account security",
      });
    } catch {
      taskId = null;
    }
    try {
      await apiClient.post("/api/auth/change-password", {
        currentPassword: current,
        newPassword: next,
      });
      setCurrent("");
      setNext("");
      setConfirm("");
      if (taskId) dock.completeTask(taskId, "Password updated — use your new password next time you sign in.");
    } catch (err) {
      const message = getErrorMessage(err, "Failed to update password.");
      if (taskId) dock.failTask(taskId, message);
      setError(message);
      toast.error({ title: "Could not update password", description: message });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div id="section-password" className={sectionStyles.boardWrap}>
      <form onSubmit={(e) => void handleSave(e)}>
        <KanbanBoard
          title="Password"
          icon={<KeyRound size={14} aria-hidden="true" />}
          description="Choose a new password at least 8 characters long."
          ariaLabel="Password settings"
          footer={
            <div className="flex justify-end px-1 pb-1">
              <Button type="submit" disabled={saving || !!liveError} aria-busy={saving || undefined} className={sectionStyles.btn}>
                {saving ? (
                  <>
                    <Loader2 size={12} className="animate-spin" aria-hidden />
                    <span aria-live="polite">Saving…</span>
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-1 gap-4 px-1 sm:grid-cols-2">
            <div className={sectionStyles.securityPanel}>
              <p className={sectionStyles.securityTitle}>
                <ShieldCheck size={14} aria-hidden="true" className="text-amber-500" />
                Keep it secure
              </p>
              <ul className={sectionStyles.securityList}>
                {SECURITY_TIPS.map((tip) => (
                  <li key={tip}>
                    <Check size={12} aria-hidden="true" className="shrink-0 text-amber-500" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              <PasswordField
                id="settings-current"
                label="Current password"
                value={current}
                autoComplete="current-password"
                onChange={(v) => {
                  setCurrent(v);
                  setError(null);
                }}
              />
              <PasswordField
                id="settings-new"
                label="New password"
                value={next}
                autoComplete="new-password"
                onChange={(v) => {
                  setNext(v);
                  setError(null);
                }}
              />
              <PasswordField
                id="settings-confirm"
                label="Confirm new password"
                value={confirm}
                autoComplete="new-password"
                onChange={(v) => {
                  setConfirm(v);
                  setError(null);
                }}
              />
              {liveError ? (
                <p role="alert" className={`${sectionStyles.formAlert} ${sectionStyles.formAlertError} ${sectionStyles.reveal}`}>
                  <CircleAlert size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
                  {liveError}
                </p>
              ) : matchOk ? (
                <p role="status" className={`${sectionStyles.formAlert} ${sectionStyles.formAlertSuccess} ${sectionStyles.reveal}`}>
                  <CircleCheck size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
                  Passwords match.
                </p>
              ) : null}
            </div>
          </div>
          {error && error !== liveError ? (
            <p role="alert" className={`mx-1 ${sectionStyles.formAlert} ${sectionStyles.formAlertError} ${sectionStyles.reveal}`}>
              <CircleAlert size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
              {error}
            </p>
          ) : null}
        </KanbanBoard>
      </form>
    </div>
  );
}
