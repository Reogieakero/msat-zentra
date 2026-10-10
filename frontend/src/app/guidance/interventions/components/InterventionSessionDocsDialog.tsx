"use client";

import * as React from "react";
import { Image as ImageIcon, Loader2, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CounselingSessionItem } from "@/services/guidance/interventions.types";
import {
  deleteInterventionSessionDoc,
  listInterventionSessionDocs,
  uploadInterventionSessionDocs,
} from "@/services/guidance/interventions.service";
import type { InterventionSessionDoc } from "@/services/guidance/interventions.types";
import { useGuidanceMutation } from "../../overview/components/use-guidance-mutation";
import { sessionTypeLabel } from "../../referrals/components/guidance-referrals-table";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPT_ATTR = "image/jpeg,image/png,image/webp";
const MAX_FILES = 5;
const MAX_BYTES = 5 * 1024 * 1024;

function apiMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const data = (err as { response?: { data?: { error?: { message?: string } } } }).response?.data;
    if (data?.error?.message) return data.error.message;
  }
  return fallback;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function InterventionSessionDocsDialog({
  followUpId,
  session,
  open,
  onClose,
  onChanged,
}: {
  followUpId: string;
  session: CounselingSessionItem;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [docs, setDocs] = React.useState<InterventionSessionDoc[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [pending, setPending] = React.useState<File[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const uploadMutation = useGuidanceMutation({
    mutationFn: (files: File[]) =>
      uploadInterventionSessionDocs(followUpId, session.id, files),
    sourceId: followUpId,
    successTitle: "Photos filed",
    successDescription: (_vars, added) =>
      `${added.length} photo${added.length === 1 ? "" : "s"} attached to this session.`,
    errorFallback: "Could not attach the photos. Try again.",
    silentError: true,
    onSuccessExtra: (added) => {
      setDocs((prev) => [...prev, ...added]);
      setPending([]);
      setError(null);
      onChanged?.();
    },
  });
  const removeMutation = useGuidanceMutation({
    mutationFn: (id: string) =>
      deleteInterventionSessionDoc(followUpId, session.id, id),
    sourceId: followUpId,
    successTitle: "Photo removed",
    successDescription: () => "The photo was removed from this session.",
    errorFallback: "Could not remove the photo. Try again.",
    silentError: true,
    onSuccessExtra: (_data, id) => {
      setDocs((prev) => prev.filter((d) => d.id !== id));
      setError(null);
      onChanged?.();
    },
  });
  const uploading = uploadMutation.isPending;
  const removingId = removeMutation.isPending
    ? ((removeMutation.variables as string | undefined) ?? null)
    : null;
  const busy = uploading || removeMutation.isPending;
  const mutationError = uploadMutation.error ?? removeMutation.error;
  const displayError = error ?? (mutationError ? mutationError.message : null);

  const docsKey = open ? `${followUpId}:${session.id}` : null;
  const [prevDocsKey, setPrevDocsKey] = React.useState<string | null>(null);
  if (docsKey !== prevDocsKey) {
    setPrevDocsKey(docsKey);
    setDocs([]);
    setLoading(true);
    setError(null);
    setPending([]);
    setDragging(false);
  }

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listInterventionSessionDocs(followUpId, session.id)
      .then((rows) => {
        if (!cancelled) setDocs(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(apiMessage(err, "Could not load the documents."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, followUpId, session.id]);

  function handleFiles(list: FileList | null) {
    if (!list || uploading) return;
    const problems: string[] = [];
    const valid: File[] = [];
    for (const f of Array.from(list)) {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        problems.push(`"${f.name}" is not a JPG, PNG, or WEBP image.`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        problems.push(`"${f.name}" is over 5 MB — pick a smaller photo.`);
        continue;
      }
      valid.push(f);
    }
    const room = Math.max(0, MAX_FILES - pending.length);
    const addable = valid.slice(0, room);
    if (valid.length > addable.length) {
      problems.push(
        `Attach at most ${MAX_FILES} images at a time — kept ${addable.length}.`
      );
    }
    setPending((prev) => [...prev, ...addable]);
    setError(problems.length > 0 ? problems.join(" ") : null);
  }

  function handleRemovePending(name: string, size: number) {
    setPending((prev) => prev.filter((f) => !(f.name === name && f.size === size)));
  }

  function handleSave() {
    if (pending.length === 0 || uploading) return;
    setError(null);
    uploadMutation.mutate(pending);
  }

  function handleRemove(id: string) {
    if (removeMutation.isPending) return;
    setError(null);
    removeMutation.mutate(id);
  }

  function tryClose() {
    if (busy) return;
    setError(null);
    onClose();
  }

  const dropDisabled = uploading || pending.length >= MAX_FILES;

  if (!open) return null;
  return (
    <CardModal
      open
      onClose={tryClose}
      dismissable={!busy}
      size="md"
      title={
        <span className="flex items-center gap-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
            <ImageIcon className="size-5" aria-hidden />
          </span>
          Session documents
        </span>
      }
      description={
        <>
          Photos filed on{" "}
          <strong className="font-medium text-slate-900 dark:text-slate-100">
            {sessionTypeLabel(session.sessionType)}
          </strong>{" "}
          for this session.
        </>
      }
      watchKey={`${docs.length}-${pending.length}-${loading}`}
    >
      <div aria-busy={busy || undefined} className="flex flex-col gap-5">
        {/* filed photos */}
        <div className="min-h-[106px] rounded-[14px] border border-slate-200 bg-slate-50 p-3.5 dark:border-[#2f2f35] dark:bg-[#1f1f23]">
          {loading ? (
            <div role="status" aria-live="polite">
              <div className="grid grid-cols-3 gap-2.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    aria-hidden
                    className="h-[76px] animate-pulse rounded-[10px] bg-slate-200 motion-reduce:animate-none dark:bg-white/10"
                  />
                ))}
              </div>
              <p className="mt-2.5 text-center text-[13px] text-slate-500 dark:text-[#a1a1aa]">
                Loading documents…
              </p>
            </div>
          ) : docs.length === 0 ? (
            <div className="flex min-h-[78px] flex-col items-center justify-center gap-1 py-2 text-center">
              <ImageIcon className="size-6 text-slate-400 dark:text-[#a1a1aa]" aria-hidden />
              <p className="text-sm font-medium text-slate-900 dark:text-[#f4f4f5]">
                No photos filed yet
              </p>
              <p className="text-[13px] text-slate-500 dark:text-[#a1a1aa]">
                Photos you attach will appear here.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-3 gap-2.5">
              {docs.map((d) => (
                <li key={d.id} className="group relative">
                  <a
                    href={d.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${d.fileName}`}
                    className="block h-[76px] overflow-hidden rounded-[10px] border border-slate-200 dark:border-white/10"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={d.fileUrl}
                      alt={d.fileName}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  </a>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    disabled={removingId === d.id || uploading}
                    onClick={() => void handleRemove(d.id)}
                    aria-label={`Remove ${d.fileName}`}
                    title={`Remove ${d.fileName}`}
                    className="absolute right-1 top-1 size-7 rounded-lg bg-white/90 opacity-0 shadow focus-visible:opacity-100 group-hover:opacity-100 dark:bg-black/70"
                  >
                    {removingId === d.id ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : (
                      <Trash2 aria-hidden />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* attach */}
        <div>
          <Label>Attach photos</Label>
          <button
            type="button"
            disabled={dropDisabled}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              if (!dropDisabled) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={cn(
              "mt-1.5 flex w-full flex-col items-center gap-1 rounded-[14px] border-[1.5px] border-dashed border-slate-300 px-4 py-[18px] transition-colors dark:border-[#46464e]",
              dragging
                ? "border-blue-500 dark:border-blue-400"
                : "hover:border-slate-400 dark:hover:border-slate-500",
              dropDisabled && "cursor-not-allowed opacity-50"
            )}
          >
            <Upload
              className="size-5 text-blue-600 dark:text-blue-300"
              aria-hidden
            />
            <span className="text-sm">
              <span className="font-semibold text-blue-600 dark:text-blue-300">
                Choose files
              </span>{" "}
              <span className="text-slate-500 dark:text-[#a1a1aa]">
                or drag and drop
              </span>
            </span>
            <span className="text-xs text-slate-500 dark:text-[#a1a1aa]">
              JPG, PNG or WEBP · max 5 at a time · 5 MB each
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            multiple
            className="sr-only"
            tabIndex={-1}
            disabled={dropDisabled}
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {displayError ? (
            <p role="alert" className="mt-2 text-[13px] leading-5 text-red-700 dark:text-[#fca5a5]">
              {displayError}
            </p>
          ) : null}
          {pending.length > 0 && (
            <ul className="mt-2 flex max-h-[140px] flex-col gap-1.5 overflow-y-auto">
              {pending.map((f) => (
                <li
                  key={`${f.name}-${f.size}`}
                  className="flex items-center gap-2 rounded-[10px] border border-slate-200 px-3 py-2 dark:border-[#2f2f35]"
                >
                  <ImageIcon className="size-4 shrink-0 text-slate-400 dark:text-[#a1a1aa]" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-900 dark:text-[#f4f4f5]">
                    {f.name}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500 dark:text-[#a1a1aa]">
                    {formatSize(f.size)}
                  </span>
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => handleRemovePending(f.name, f.size)}
                    aria-label={`Remove ${f.name}`}
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/10"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* footer */}
        <div className="-mx-5 -mb-5 flex items-center gap-4 border-t border-slate-200 px-6 py-4 dark:border-white/10">
          <p className="flex-1 text-[13px] text-slate-500 dark:text-[#a1a1aa]">
            {pending.length === 0
              ? "No files selected"
              : `${pending.length} of ${MAX_FILES} selected`}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={tryClose}
            disabled={busy}
            className="h-8 rounded-[8px] px-4"
          >
            Close
          </Button>
          <Button
            type="button"
            disabled={pending.length === 0 || uploading}
            onClick={() => void handleSave()}
            aria-busy={uploading || undefined}
            className="h-8 rounded-[8px] bg-[#2563eb] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-white/10 dark:disabled:text-slate-500"
          >
            {uploading ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {uploading
              ? "Uploading…"
              : pending.length === 0
                ? "Add photos"
                : `Add ${pending.length} photo${pending.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    </CardModal>
  );
}
