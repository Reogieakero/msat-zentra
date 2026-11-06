"use client";

import * as React from "react";
import { FileText, Link2, Loader2, Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { Label } from "@/components/ui/label";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";
import type { StudentModuleRow, StudentSubmissionKind } from "@/services/student/modules.service";

const ACCEPTED_ANSWER = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ACCEPTED_PROOF = `${ACCEPTED_ANSWER},.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp`;

const KIND_OPTIONS: {
  value: StudentSubmissionKind;
  label: string;
  icon: typeof Link2;
  hint: string;
}[] = [
  { value: "link", label: "Link", icon: Link2, hint: "Paste the link to your answered module." },
  { value: "file", label: "File", icon: FileText, hint: "Upload your answer as PDF or Word." },
  { value: "physical", label: "Passed in person", icon: Users, hint: "You handed the paper module to your adviser." },
];

export interface StudentSubmitPayload {
  kind: StudentSubmissionKind;
  submissionUrl?: string;
  remarks?: string | null;
  /** Answered file (kind=file) or proof of hand-in (kind=physical). */
  file?: File;
}

export function StudentSubmitDialog({
  module,
  pending,
  onClose,
  onSubmit,
}: {
  module: StudentModuleRow;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: StudentSubmitPayload) => void;
}) {
  const [kind, setKind] = React.useState<StudentSubmissionKind>(
    module.submitted ? module.submissionKind : "link",
  );
  const [submissionUrl, setSubmissionUrl] = React.useState(module.submissionUrl ?? "");
  const [remarks, setRemarks] = React.useState(module.remarks ?? "");
  const [file, setFile] = React.useState<File | null>(null);

  const hasLink = submissionUrl.trim().length > 0;
  const canSubmit = !pending && (kind === "link" ? hasLink : kind === "file" ? Boolean(file) : true);

  const handleSubmit = () => {
    if (!canSubmit) return;
    const trimmedRemarks = remarks.trim() ? remarks.trim() : null;
    if (kind === "link") {
      onSubmit({ kind, submissionUrl: submissionUrl.trim(), remarks: trimmedRemarks });
      return;
    }
    if (kind === "file") {
      if (!file) return;
      onSubmit({ kind, file, remarks: trimmedRemarks });
      return;
    }
    onSubmit({ kind, file: file ?? undefined, remarks: trimmedRemarks });
  };

  return (
    <KanbanOverlay
      open
      onClose={() => {
        if (!pending) onClose();
      }}
      dismissable={!pending}
      title={module.submitted ? "Update your submission" : "Submit your module"}
      ariaLabel={`Submit ${module.moduleName}`}
      icon={<Upload size={16} aria-hidden />}
      description={module.moduleName}
      width="lg"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2 px-1 pb-1">
          <Button
            type="button"
            className="h-6 px-2.5 text-xs"
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-busy={pending || undefined}
          >
            {pending ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null}
            {module.submitted ? "Save changes" : "Submit module"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Label>How are you submitting it?</Label>
          <div role="radiogroup" aria-label="Submission type" className="grid gap-2 sm:grid-cols-3">
            {KIND_OPTIONS.map(({ value, label, icon: Icon, hint }) => {
              const active = kind === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={pending}
                  onClick={() => setKind(value)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-md border px-2.5 py-2 text-left transition-colors",
                    active
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <span className="inline-flex items-center gap-1 text-xs font-semibold">
                    <Icon size={12} aria-hidden /> {label}
                  </span>
                  <span className="text-[11px] leading-tight">{hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        {kind === "link" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="student-answer-url">Answered module link</Label>
            <Input
              id="student-answer-url"
              type="url"
              inputMode="url"
              value={submissionUrl}
              onChange={(e) => setSubmissionUrl(e.target.value)}
              placeholder="https://drive.google.com/…"
              autoFocus
            />
            <p className="m-0 text-[11px] text-muted-foreground">
              Saving the link submits your answer right away.
            </p>
          </div>
        ) : null}

        {kind === "file" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="student-answer-file">Your answer (PDF or Word)</Label>
            <Input
              id="student-answer-file"
              type="file"
              accept={ACCEPTED_ANSWER}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={pending}
            />
            <p className="m-0 text-[11px] text-muted-foreground">
              {file
                ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`
                : "Max 10 MB. Uploading submits your answer right away."}
            </p>
          </div>
        ) : null}

        {kind === "physical" ? (
          <div className="flex flex-col gap-2 rounded-md border border-dashed px-3 py-2">
            <p className="m-0 text-xs text-muted-foreground">
              Your adviser marks the paper module as received. You can attach a photo or
              scan as proof.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="student-proof">Proof (optional)</Label>
              <Input
                id="student-proof"
                type="file"
                accept={ACCEPTED_PROOF}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={pending}
              />
              {file ? (
                <p className="m-0 text-[11px] text-muted-foreground">
                  {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="student-remarks">Note to your adviser (optional)</Label>
          <Input
            id="student-remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Partial answer, will finish the rest tomorrow"
            maxLength={1000}
          />
        </div>

        {module.submitted ? (
          <Pill tone="amber" label="Note">
            Submitting again replaces your previous answer.
          </Pill>
        ) : null}
      </div>
    </KanbanOverlay>
  );
}
