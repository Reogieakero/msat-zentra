"use client";
import { useCallback, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useTeacherInvalidate } from "../../components/use-teacher-invalidate";
import { toast } from "@/components/ui/sonner";
export type TeacherRow = {
  fullName: string;
};
function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
export type TeacherCreateRowState = {
  name: string;
  status: "creating" | "created" | "failed";
  message?: string;
};

export type TeacherCreateProgress = {
  active: boolean;
  done: boolean;
  rows: TeacherCreateRowState[];
  startedAt: number;
};

export function useAddTeachers(onClose: () => void, onProgress?: (p: TeacherCreateProgress | null) => void) {
  const invalidateTeacher = useTeacherInvalidate();
  const [rows, setRows] = useState<TeacherRow[]>([{ fullName: "" }]);
  const [formError, setFormError] = useState<string | null>(null);
  const startedAtRef = useRef(0);
  const patchRow = (i: number, patch: Partial<TeacherRow>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const filled = rows.filter((r) => r.fullName.trim() !== "");
  const createMany = useMutation({
    mutationFn: async (items: TeacherRow[]) => {
      const results = await Promise.allSettled(
        items.map((it) =>
          apiClient.post("/api/teacher/schedule/teachers", { fullName: it.fullName.trim() }),
        ),
      );
      return { items, results };
    },
    onSuccess: ({ items, results }) => {
      const okIndexes = new Set(
        results.map((r, i) => (r.status === "fulfilled" ? i : -1)).filter((i) => i >= 0),
      );
      const failed = items.filter((_, i) => !okIndexes.has(i));
      // Bottom-right dock (adviser-check style): one row per name.
      onProgress?.({
        active: false,
        done: true,
        rows: items.map((it, i) => {
          const name = it.fullName.trim() || `Row ${i + 1}`;
          if (okIndexes.has(i)) return { name, status: "created" as const };
          const r = results[i];
          const message =
            r.status === "rejected" ? getErrorMessage(r.reason, "failed") : "failed";
          return { name, status: "failed" as const, message };
        }),
        startedAt: startedAtRef.current,
      });
      if (okIndexes.size > 0) {
        invalidateTeacher.schedule();
        toast.success({
          title: `${okIndexes.size} teacher${okIndexes.size === 1 ? "" : "s"} added`,
          description: "Names are now pickable in timetable slots.",
        });
      }
      if (failed.length > 0) {
        const details = results
          .map((r, i) =>
            r.status === "rejected"
              ? `${items[i].fullName.trim() || `row ${i + 1}`}: ${getErrorMessage(r.reason, "failed")}`
              : null,
          )
          .filter(Boolean)
          .join("; ");
        setRows(failed.map((r) => ({ ...r })));
        setFormError(`${failed.length} failed: ${details}`);
        toast.error({ title: "Some teachers were not added", description: details });
      } else {
        onClose();
      }
    },
  });
  const handleCreate = useCallback(() => {
    if (filled.length === 0) {
      setFormError("Add at least one teacher name.");
      return;
    }
    setFormError(null);
    startedAtRef.current = Date.now();
    onProgress?.({
      active: true,
      done: false,
      rows: filled.map((r) => ({ name: r.fullName.trim(), status: "creating" as const })),
      startedAt: startedAtRef.current,
    });
    createMany.mutate(filled);
  }, [createMany, filled, onProgress]);
  return { rows, setRows, patchRow, filled, formError, createMany, handleCreate };
}
