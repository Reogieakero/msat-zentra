"use client";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardModal } from "@/components/ui/CardModal";
import { ScrollList } from "@/components/ui/scroll-list";
import kanbanStyles from "./subject-kanban.module.css";
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
        <ScrollList className="max-h-[32dvh] gap-2 px-1" ariaLabel="New teacher names">
          {rows.map((row, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border border-input p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Teacher {i + 1}</span>
                {rows.length > 1 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`Remove teacher row ${i + 1}`}
                    className="h-6 px-2 text-xs"
                  >
                    <Trash2 size={14} aria-hidden />
                  </Button>
                ) : null}
              </div>
              <Input
                placeholder="Full name"
                autoComplete="name"
                value={row.fullName}
                onChange={(e) => patchRow(i, { fullName: e.target.value })}
                aria-label={`Teacher ${i + 1} full name`}
              />
            </div>
          ))}
        </ScrollList>
        {rows.length < MAX_ROWS ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRows((prev) => [...prev, { fullName: "" }])}
            className="h-6 px-2 text-xs self-start"
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
            <ScrollList as="ul" className="mt-2 max-h-40 gap-1" ariaLabel="Existing teacher names">
              {teachers.map((t, idx) => (
                <li
                  key={t.id}
                  className={kanbanStyles.card}
                  style={{ animationDelay: `${Math.min(idx, 8) * 35}ms` }}
                >
                  <span className={kanbanStyles.name} title={t.name}>
                    {t.name}
                    {t.linked ? (
                      <span className="ml-1 text-[11px] font-medium text-green-600 dark:text-green-500">
                        · Linked
                      </span>
                    ) : null}
                  </span>
                  <span className={kanbanStyles.meta}>
                    <span className="shrink-0 rounded-full border border-border bg-muted/40 px-1.5 font-mono text-[10px] text-muted-foreground">
                      {t.code ?? "—"}
                    </span>
                  </span>
                </li>
              ))}
            </ScrollList>
          )}
        </details>
        {formError ? (
          <p role="alert" className="font-sans text-xs text-red-600 dark:text-red-400">
            {formError}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            variant="destructive"
            onClick={onClose}
            disabled={createMany.isPending}
            className="h-6 px-2 text-xs"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createMany.isPending || filled.length === 0}
            aria-busy={createMany.isPending || undefined}
            className="h-6 px-2 text-xs"
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
