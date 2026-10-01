"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookPlus, Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownSelect } from "@/app/principal/academics/assign/components/DropdownSelect";
// Same grid-card shell as the principal's assign grid — glow, hover, radius.
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "../schedule-empty.module.css";
import type { ScheduleSubject } from "../page";

const MAX_ROWS = 10;

type TeacherRow = {
  fullName: string;
};

type SubjectRow = {
  name: string;
  code: string;
};

function getErrorMessage(err: unknown, fallback: string): string {
  // The backend envelopes errors as { error: { code, message } } — read that
  // first so users see the real reason instead of axios's raw status text.
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function AddTeacherDialog({
  onClose,
  teachers,
}: {
  onClose: () => void;
  teachers: { id: string; name: string; code: string | null; linked: boolean }[];
}) {  const queryClient = useQueryClient();
  const [rows, setRows] = useState<TeacherRow[]>([{ fullName: "" }]);
  const [formError, setFormError] = useState<string | null>(null);

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
      if (okIndexes.size > 0) {
        void queryClient.invalidateQueries({ queryKey: ["teacher-schedule-teachers"] });
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

  const handleCreate = () => {
    if (filled.length === 0) {
      setFormError("Add at least one teacher name.");
      return;
    }
    setFormError(null);
    createMany.mutate(filled);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add teachers</DialogTitle>
          <DialogDescription>
            Type each name once, then pick from the list. Just names — no accounts involved.
          </DialogDescription>
        </DialogHeader>

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

        <DialogFooter>
          <Button variant="destructive" onClick={onClose}>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function categoryLabel(category: string): string {
  return category === "ELECTIVE" ? "Elective" : "Core";
}

export function AddSubjectDialog({
  onClose,
  subjects,
  teachers,
}: {
  onClose: () => void;
  subjects: ScheduleSubject[];
  teachers: { id: string; name: string; code: string | null; linked: boolean }[];
}) {
  const queryClient = useQueryClient();
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
        void queryClient.invalidateQueries({ queryKey: ["teacher-schedule-subjects"] });
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

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add subjects</DialogTitle>
          <DialogDescription>
            Subjects are usable in the timetable immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>Grade level (all rows)</span>
            <DropdownSelect
              value={gradeLevel}
              onValueChange={setGradeLevel}
              options={[
                { value: "G7", label: "Grade 7" },
                { value: "G8", label: "Grade 8" },
                { value: "G9", label: "Grade 9" },
                { value: "G10", label: "Grade 10" },
              ]}
              ariaLabel="Grade level"
            />
          </div>
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>Category (all rows)</span>
            <DropdownSelect
              value={category}
              onValueChange={setCategory}
              options={[
                { value: "CORE", label: "Core" },
                { value: "ELECTIVE", label: "Elective" },
              ]}
              ariaLabel="Category"
            />
          </div>
        </div>

        <div className={`flex max-h-[40dvh] flex-col gap-2 overflow-y-auto pr-0.5 ${styles.noScrollbar}`}>
          {rows.map((row, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border border-input p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Subject {i + 1}</span>
                {rows.length > 1 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`Remove subject row ${i + 1}`}
                  >
                    <Trash2 size={14} aria-hidden />
                  </Button>
                ) : null}
              </div>
              <Input
                placeholder="Subject name"
                value={row.name}
                onChange={(e) => patchRow(i, { name: e.target.value })}
                aria-label={`Subject ${i + 1} name`}
              />
              <Input
                placeholder="Code (e.g. MATH7)"
                value={row.code}
                onChange={(e) => patchRow(i, { code: e.target.value.toUpperCase() })}
                aria-label={`Subject ${i + 1} code`}
              />
            </div>
          ))}
        </div>
        {rows.length < MAX_ROWS ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRows((prev) => [...prev, { name: "", code: "" }])}
            className="self-start"
          >
            <Plus size={14} aria-hidden />
            Add another
          </Button>
        ) : null}
        <details className="rounded-lg border border-input px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">
            Existing subjects ({subjects.length})
          </summary>
          {subjects.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No subjects listed yet.</p>
          ) : (
            <ul className={`mt-2 grid max-h-40 gap-1 overflow-y-auto ${styles.noScrollbar}`}>
              {subjects.map((s) => (
                <li key={s.id} className="text-sm">
                  {s.name}{" "}
                  <span className="text-muted-foreground">
                    ({s.code}) · Grade {s.gradeLevel.replace("G", "")} · {categoryLabel(s.category)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </details>
        <details className="rounded-lg border border-input px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">
            Teacher names ({teachers.length})
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

        <DialogFooter>
          <Button variant="destructive" onClick={onClose}>
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
              `Create ${filled.length > 0 ? `${filled.length} ` : ""}subject${filled.length === 1 ? "" : "s"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Workspace catalog actions: standalone cards for creating subjects and
// teacher accounts. They invalidate the slot overlay's list queries, so
// anything created here appears there without a refresh. `layout="rail"`
// stacks them in a narrow right column (setup view); otherwise they sit in
// the two-column grid.
export function CatalogCards({ layout = "grid" }: { layout?: "grid" | "rail" }) {
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [teacherListOpen, setTeacherListOpen] = useState(false);

  const subjectsQuery = useQuery<{ subjects: ScheduleSubject[] }>({
    queryKey: ["teacher-schedule-subjects"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ subjects: ScheduleSubject[] }>(
        "/api/teacher/schedule/subjects",
      );
      return data;
    },
  });
  const subjects = subjectsQuery.data?.subjects ?? [];

  const teachersQuery = useQuery<{ teachers: { id: string; name: string; code: string | null; linked: boolean }[] }>({
    queryKey: ["teacher-schedule-teachers"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ teachers: { id: string; name: string; code: string | null; linked: boolean }[] }>(
        "/api/teacher/schedule/teachers",
      );
      return data;
    },
  });
  const teacherNames = teachersQuery.data?.teachers ?? [];

  return (
    <>
      <div className={layout === "rail" ? "flex flex-col gap-4" : "grid gap-4 sm:grid-cols-2"}>
        <div className={assign.card}>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
              aria-hidden="true"
            >
              <BookPlus size={20} className="text-primary" />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold">Add Subject</h3>
              <p className="text-xs text-muted-foreground">
                Create one or more subjects for grades 7–10. Usable immediately.
              </p>
            </div>
          </div>
          <div className="relative mt-auto flex gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setListOpen(true)}>
              See all
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSubjectOpen(true)}>
              Add subject
            </Button>
          </div>
        </div>
        <div className={assign.card}>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
              aria-hidden="true"
            >
              <UserPlus size={20} className="text-primary" />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold">Add Teachers</h3>
              <p className="text-xs text-muted-foreground">
                Type a name once, pick it forever. Just a name list.
              </p>
            </div>
          </div>
          <div className="relative mt-auto flex gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setTeacherListOpen(true)}>
              See all
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTeacherOpen(true)}>
              Add teacher
            </Button>
          </div>
        </div>
      </div>
      {subjectOpen ? (
        <AddSubjectDialog
          onClose={() => setSubjectOpen(false)}
          subjects={subjects}
          teachers={teacherNames}
        />
      ) : null}
      {teacherOpen ? (
        <AddTeacherDialog onClose={() => setTeacherOpen(false)} teachers={teacherNames} />
      ) : null}
      {listOpen ? (
        <SubjectListDialog
          subjects={subjects}
          pending={subjectsQuery.isPending}
          loadError={subjectsQuery.isError}
          onClose={() => setListOpen(false)}
        />
      ) : null}
      {teacherListOpen ? (
        <TeacherListDialog
          teachers={teacherNames}
          pending={teachersQuery.isPending}
          loadError={teachersQuery.isError}
          onClose={() => setTeacherListOpen(false)}
        />
      ) : null}
    </>
  );
}

function SubjectListDialog({
  subjects,
  pending,
  loadError,
  onClose,
}: {
  subjects: ScheduleSubject[];
  pending: boolean;
  loadError: boolean;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = subjects.filter((s) =>
    `${s.name} ${s.code}`.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Subjects</DialogTitle>
          <DialogDescription>
            Grades 7–10 · {subjects.length} total
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Search name or code…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search subjects"
        />
        {pending ? (
          <div className="grid gap-1.5" aria-busy="true" aria-label="Loading subjects">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-muted" />
            ))}
          </div>
        ) : loadError ? (
          <p role="alert" className="text-sm text-destructive">
            Could not load subjects.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches.</p>
        ) : (
          <div
            className={`grid max-h-[50dvh] gap-1.5 overflow-y-auto pr-0.5 ${styles.noScrollbar}`}
            role="list"
            aria-label="Subjects"
          >
            {filtered.map((s) => (
              <div
                key={s.id}
                role="listitem"
                className="flex items-center justify-between gap-2 rounded-lg border border-input px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate font-medium">
                  {s.name} <span className="font-normal text-muted-foreground">({s.code})</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  Grade {s.gradeLevel.replace("G", "")} · {categoryLabel(s.category)}
                </span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TeacherListDialog({
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
  const queryClient = useQueryClient();
  const filtered = teachers.filter((t) =>
    t.name.toLowerCase().includes(q.trim().toLowerCase()),
  );

  const deleteAll = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.delete("/api/teacher/schedule/teachers");
      return data as { deleted: number };
    },
    onSuccess: (data) => {
      setConfirming(false);
      void queryClient.invalidateQueries({ queryKey: ["teacher-schedule-teachers"] });
      void queryClient.invalidateQueries({ queryKey: ["teacher-schedule"] });
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Teachers</DialogTitle>
          <DialogDescription>
            {teachers.length} name{teachers.length === 1 ? "" : "s"} total
          </DialogDescription>
        </DialogHeader>

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
        <DialogFooter>
          {confirming ? (
            <>
              <Button variant="destructive" onClick={() => setConfirming(false)}>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
