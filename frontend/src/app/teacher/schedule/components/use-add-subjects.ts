"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useTeacherInvalidate } from "../../components/use-teacher-invalidate";
import { toast } from "@/components/ui/sonner";
export type SubjectRow = {
  name: string;
  code: string;
};
function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
export function useAddSubjects(onClose: () => void) {
  const invalidateTeacher = useTeacherInvalidate();
  const [rows, setRows] = useState<SubjectRow[]>([{ name: "", code: "" }]);
  const [gradeLevel, setGradeLevel] = useState("G7");
  const [category, setCategory] = useState("CORE");
  const [formError, setFormError] = useState<string | null>(null);
  const patchRow = (i: number, patch: Partial<SubjectRow>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const filled = rows.filter((r) => r.name.trim() !== "" || r.code.trim() !== "");
  const partial = filled.filter((r) => !(r.name.trim() !== "" && r.code.trim() !== ""));
  const codes = filled.map((r) => r.code.trim().toUpperCase());
  const dupCode = codes.length !== new Set(codes).size;
  const createMany = useMutation({
    mutationFn: async (vars: { items: SubjectRow[]; category: string }) => {
      const results = await Promise.allSettled(
        vars.items.map((it) =>
          apiClient.post("/api/teacher/schedule/subjects", {
            name: it.name.trim(),
            code: it.code.trim(),
            gradeLevel,
            category: vars.category,
          }),
        ),
      );
      return { items: vars.items, results };
    },
    onSuccess: ({ items, results }) => {
      const okIndexes = new Set(
        results.map((r, i) => (r.status === "fulfilled" ? i : -1)).filter((i) => i >= 0),
      );
      const failed = items.filter((_, i) => !okIndexes.has(i));
      if (okIndexes.size > 0) {
        invalidateTeacher.schedule();
        toast.success({
          title: `${okIndexes.size} subject${okIndexes.size === 1 ? "" : "s"} created`,
          description: "Usable in the timetable immediately.",
        });
      }
      if (failed.length > 0) {
        const details = results
          .map((r, i) =>
            r.status === "rejected"
              ? `${items[i].code.trim().toUpperCase() || `row ${i + 1}`}: ${getErrorMessage(r.reason, "failed")}`
              : null,
          )
          .filter(Boolean)
          .join("; ");
        setRows(failed.map((r) => ({ ...r })));
        setFormError(`${failed.length} failed: ${details}`);
        toast.error({ title: "Some subjects were not created", description: details });
      } else {
        onClose();
      }
    },
  });
  const handleCreate = () => {
    if (partial.length > 0) {
      setFormError("Finish every started row: subject name and code.");
      return;
    }
    if (dupCode) {
      setFormError("Two rows share the same code.");
      return;
    }
    if (filled.length === 0) {
      setFormError("Add at least one subject.");
      return;
    }
    setFormError(null);
    createMany.mutate({ items: filled, category });
  };
  return {
    rows,
    setRows,
    patchRow,
    filled,
    gradeLevel,
    setGradeLevel,
    category,
    setCategory,
    formError,
    createMany,
    handleCreate,
  };
}
