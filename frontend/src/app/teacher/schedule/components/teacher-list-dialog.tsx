"use client";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useTeacherInvalidate } from "../../components/use-teacher-invalidate";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardModal } from "@/components/ui/CardModal";
import styles from "../schedule-empty.module.css";
function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
export function TeacherListDialog({
  teachers,
  pending,
  loadError,
  onClose,
}: {
  teachers: { id: string; name: string; code: string | null; linked: boolean }[];
  pending: boolean;
  loadError: boolean;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [confirming, setConfirming] = useState(false);
  const invalidateTeacher = useTeacherInvalidate();
  const needle = q.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      needle === ""
        ? teachers
        : teachers.filter((t) => t.name.toLowerCase().includes(needle)),
    [teachers, needle],
  );
  const deleteAll = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.delete("/api/teacher/schedule/teachers");
      return data as { deleted: number };
    },
    onSuccess: (data) => {
      setConfirming(false);
      invalidateTeacher.schedule();
      toast.success({
        title: "Teacher list cleared",
        description: `${data.deleted} name${data.deleted === 1 ? "" : "s"} removed.`,
      });
      onClose();
    },
    onError: (err: unknown) => {
      toast.error({ title: "Could not clear list", description: getErrorMessage(err, "Failed to clear teacher names.") });
    },
  });
  return (
    <CardModal
      open
      onClose={onClose}
      dismissable={!deleteAll.isPending}
      size="md"
      title="Teachers"
      description={
        <>
          {teachers.length} name{teachers.length === 1 ? "" : "s"} total
        </>
      }
      watchKey={pending}
    >
        <Input
          placeholder="Search name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search teachers"
        />
        {confirming ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p className="font-semibold">Delete all {teachers.length} names?</p>
            <p className="mt-1 text-muted-foreground">
              Timetable cells using these names will be cleared too. This cannot be undone.
            </p>
          </div>
        ) : pending ? (
          <div className="grid gap-1.5" aria-busy="true" aria-label="Loading teachers">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-muted" />
            ))}
          </div>
        ) : loadError ? (
          <p role="alert" className="text-sm text-destructive">
            Could not load teachers.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches.</p>
        ) : (
          <div
            className={`grid max-h-[50dvh] gap-1.5 overflow-y-auto pr-0.5 ${styles.noScrollbar}`}
            role="list"
            aria-label="Teachers"
          >
            {filtered.map((t) => (
              <div
                key={t.id}
                role="listitem"
                className="flex items-center justify-between gap-2 rounded-lg border border-input px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate font-medium">{t.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{t.code ?? "—"}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          {confirming ? (
            <>
              <Button
                variant="destructive"
                onClick={() => setConfirming(false)}
                disabled={deleteAll.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteAll.mutate()}
                disabled={deleteAll.isPending}
                aria-busy={deleteAll.isPending || undefined}
              >
                {deleteAll.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" aria-hidden />
                    <span aria-live="polite">Removing…</span>
                  </>
                ) : (
                  "Delete all"
                )}
              </Button>
            </>
          ) : (
            <Button
              variant="destructive"
              onClick={() => setConfirming(true)}
              disabled={teachers.length === 0 || pending}
            >
              Delete all
            </Button>
          )}
        </div>
    </CardModal>
  );
}
