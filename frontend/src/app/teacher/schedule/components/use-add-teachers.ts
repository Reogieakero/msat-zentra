"use client";
import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useTeacherInvalidate } from "../../components/use-teacher-invalidate";
import { toast } from "@/components/ui/sonner";
import { consumeOptimisticCancelled } from "./schedule-optimistic";
import type { CatalogTeacher } from "./use-schedule-catalog";
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

type CreateVars = {
  items: TeacherRow[];
  /** Rows painted into the catalog immediately, before the POSTs land. */
  optimistic: CatalogTeacher[];
};

/**
 * Apply a patch to every cached teacher catalog (`["teacher-schedule-teachers",
 * …]`, one per term scope) so the list updates the moment a row is submitted.
 */
function patchTeacherLists(
  qc: QueryClient,
  patch: (list: CatalogTeacher[]) => CatalogTeacher[],
) {
  for (const entry of qc.getQueryCache().findAll({ queryKey: ["teacher-schedule-teachers"] })) {
    qc.setQueryData(entry.queryKey, (prev: unknown) => {
      if (
        prev &&
        typeof prev === "object" &&
        Array.isArray((prev as { teachers?: unknown }).teachers)
      ) {
        return {
          ...(prev as Record<string, unknown>),
          teachers: patch((prev as { teachers: CatalogTeacher[] }).teachers ?? []),
        };
      }
      if (Array.isArray(prev)) return patch(prev as CatalogTeacher[]);
      return prev;
    });
  }
}

export function useAddTeachers(onClose: () => void, onProgress?: (p: TeacherCreateProgress | null) => void) {
  const qc = useQueryClient();
  const invalidateTeacher = useTeacherInvalidate();
  const [rows, setRows] = useState<TeacherRow[]>([{ fullName: "" }]);
  const [formError, setFormError] = useState<string | null>(null);
  const startedAtRef = useRef(0);
  const patchRow = (i: number, patch: Partial<TeacherRow>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const filled = rows.filter((r) => r.fullName.trim() !== "");
  const createMany = useMutation({
    mutationFn: async (vars: CreateVars) => {
      const results = await Promise.allSettled(
        vars.items.map((it) =>
          apiClient.post("/api/teacher/schedule/teachers", { fullName: it.fullName.trim() }),
        ),
      );
      return { items: vars.items, results, optimistic: vars.optimistic };
    },
    onSuccess: ({ items, results, optimistic }) => {
      const okIndexes = new Set(
        results.map((r, i) => (r.status === "fulfilled" ? i : -1)).filter((i) => i >= 0),
      );
      const failed = items.filter((_, i) => !okIndexes.has(i));
      // Swap placeholders for the server rows in a single cache write. A
      // placeholder deleted while the POST was in flight is dropped and its
      // new server row is deleted again, so it never reappears in the list.
      const created: CatalogTeacher[] = [];
      results.forEach((r, i) => {
        if (r.status !== "fulfilled") return;
        const data = r.value?.data as
          | { id: string; name: string; code: string | null }
          | undefined;
        if (!data?.id) return;
        if (optimistic[i] && consumeOptimisticCancelled(optimistic[i].id)) {
          void apiClient
            .delete(`/api/teacher/schedule/teachers/${data.id}`)
            .catch(() => undefined);
          return;
        }
        created.push({ ...data, linked: false });
      });
      const optimisticIds = new Set(optimistic.map((t) => t.id));
      patchTeacherLists(qc, (list) => {
        const base = list.filter((t) => !optimisticIds.has(t.id));
        const known = new Set(base.map((t) => t.id));
        return [...base, ...created.filter((t) => t.id && !known.has(t.id))];
      });
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
    onError: (_err, vars) => {
      const optimisticIds = new Set(vars.optimistic.map((t) => t.id));
      patchTeacherLists(qc, (list) => list.filter((t) => !optimisticIds.has(t.id)));
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
    // Optimistic catalog write + instant dismiss: names show up (and animate
    // in) before the requests are sent.
    const stamp = Date.now();
    const optimistic: CatalogTeacher[] = filled.map((r, i) => ({
      id: `optimistic-${stamp}-${i}`,
      name: r.fullName.trim(),
      code: null,
      linked: false,
    }));
    patchTeacherLists(qc, (list) => [...list, ...optimistic]);
    onClose();
    createMany.mutate({ items: filled, optimistic });
  }, [createMany, filled, onClose, onProgress, qc]);
  return { rows, setRows, patchRow, filled, formError, createMany, handleCreate };
}
