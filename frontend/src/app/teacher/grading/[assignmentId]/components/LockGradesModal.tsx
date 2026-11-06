"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, Loader2, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";

type Props = {
  open: boolean;
  subjectLabel: string;
  unlockCount: number;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (code: string) => void;
};

export function LockGradesModal({ open, subjectLabel, unlockCount, pending, error, onClose, onConfirm }: Props) {
  const [code, setCode] = React.useState("");
  const [show, setShow] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  // Client-only mount flag without a setState-in-effect (react-compiler gate).
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Reset the form when the modal opens (render-time adjustment, not an effect).
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setCode("");
      setShow(false);
    }
  }

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, pending]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted) return null;

  const [subjectPart, sectionPart] = subjectLabel.split(" — ").map((s) => s.trim());

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 p-4 animate-in fade-in-0 duration-150 [font-family:var(--font-inter)] dark:bg-black/70"
      onMouseDown={(e) => {
        if (!pending && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[24rem] animate-in fade-in-0 zoom-in-95 duration-150">
        <KanbanBoard
          title="Lock grades"
          icon={
            <span className="text-amber-500" aria-hidden>
              <Lock size={14} />
            </span>
          }
          actions={
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              aria-label="Close dialog"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              <X size={14} aria-hidden="true" />
            </button>
          }
          description={
            <span className="flex flex-wrap items-center gap-1">
              {subjectPart ? <Pill tone="amber" label="Subject">{subjectPart}</Pill> : null}
              {sectionPart ? <Pill tone="amber" label="Section">{sectionPart}</Pill> : null}
              <Pill tone="amber" label="Learners ready to lock">
                {unlockCount} learner{unlockCount === 1 ? "" : "s"} ready to lock
              </Pill>
            </span>
          }
          ariaLabel="Lock grades"
          boardLabel={`Lock grades, ${subjectLabel}, ${unlockCount} learners`}
          className="bg-card shadow-xl"
          footer={
            <div className="flex items-center justify-end gap-2 border-t border-border px-1 pt-2 pb-1">
              <Button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="h-6 border border-transparent bg-red-600 px-3 text-xs font-medium text-white hover:bg-red-700 focus-visible:ring-red-600/30 dark:bg-red-600 dark:text-white dark:hover:bg-red-700"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!code.trim() || pending || unlockCount === 0}
                onClick={() => onConfirm(code.trim())}
                className="h-6 px-3 text-xs"
              >
                {pending ? (
                  <>
                    <Loader2 size={13} className="animate-spin" aria-hidden />
                    Locking…
                  </>
                ) : (
                  `Confirm lock (${unlockCount})`
                )}
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-2 px-1">
            <Label htmlFor="lock-grades-code">Subject teacher code</Label>
            <div className="relative">
              <Input
                id="lock-grades-code"
                ref={inputRef}
                type={show ? "text" : "password"}
                autoComplete="off"
                placeholder="Enter the code you linked in My Classes"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && code.trim() && !pending) onConfirm(code.trim());
                }}
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-pressed={show}
                aria-label={show ? "Hide code" : "Show code"}
                className="absolute top-1/2 right-1.5 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
              >
                {show ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Must match the schedule link code on your Classes page. Locked grades go to the adviser, then appear in
              Final Grades for the registrar / record keeper.
            </p>
            {unlockCount === 0 ? (
              <p role="note" className="text-xs text-amber-500">
                Nothing to lock in this view — switch to the term with unlocked grades (with computed averages).
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        </KanbanBoard>
      </div>
    </div>,
    document.body,
  );
}
