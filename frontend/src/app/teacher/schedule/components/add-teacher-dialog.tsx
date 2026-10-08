"use client";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardModal } from "@/components/ui/CardModal";
import styles from "../schedule-empty.module.css";
import { useAddTeachers } from "./use-add-teachers";
const MAX_ROWS = 10;
export function AddTeacherDialog({
  onClose,
  teachers,
}: {
  onClose: () => void;
  teachers: { id: string; name: string; code: string | null; linked: boolean }[];
}) {
  const { rows, setRows, patchRow, filled, formError, createMany, handleCreate } =
    useAddTeachers(onClose);
  return (
    <CardModal
      open
      onClose={onClose}
      dismissable={!createMany.isPending}
      size="md"
      title="Add teachers"
      description="Type each name once, then pick from the list. Just names — no accounts involved."
      watchKey={createMany.isPending}
    >
        <div className={`flex max-h-[32dvh] flex-col gap-2 overflow-y-auto pr-0.5 ${styles.noScrollbar}`}>
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="Full name"
                autoComplete="name"
                value={row.fullName}
                onChange={(e) => patchRow(i, { fullName: e.target.value })}
                aria-label={`Teacher ${i + 1} full name`}
              />
              {rows.length > 1 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={`Remove teacher row ${i + 1}`}
                >
                  <Trash2 size={14} aria-hidden />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
        {rows.length < MAX_ROWS ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRows((prev) => [...prev, { fullName: "" }])}
            className="self-start"
          >
            <Plus size={14} aria-hidden />
            Add another
          </Button>
        ) : null}
        <details className="rounded-lg border border-input px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">
            Existing teacher names ({teachers.length})
          </summary>
          {teachers.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No names listed yet.</p>
          ) : (
            <ul className={`mt-2 grid max-h-40 gap-1 overflow-y-auto ${styles.noScrollbar}`}>
              {teachers.map((t) => (
                <li key={t.id} className="text-sm">
                  {t.name}{" "}
                  <span className="text-muted-foreground">({t.code ?? "—"})</span>
                  {t.linked ? (
                    <span className="ml-1 text-xs font-medium text-green-600 dark:text-green-500">
                      · Linked
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </details>
        {formError ? (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            variant="destructive"
            onClick={onClose}
            disabled={createMany.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createMany.isPending || filled.length === 0}
            aria-busy={createMany.isPending || undefined}
          >
            {createMany.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden />
                <span aria-live="polite">Creating…</span>
              </>
            ) : (
              `Create ${filled.length > 0 ? `${filled.length} ` : ""}teacher${filled.length === 1 ? "" : "s"}`
            )}
          </Button>
        </div>
    </CardModal>
  );
}
