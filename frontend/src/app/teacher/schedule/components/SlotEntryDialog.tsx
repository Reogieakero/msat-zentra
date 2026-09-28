"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownSelect } from "@/app/principal/academics/assign/components/DropdownSelect";

export type SlotValue = {
  subjectId: string;
  teacherNameId: string | null;
};

type Props = {
  sectionName: string;
  /** Section grade ("G7") — shown for context. */
  gradeLevel: string;
  /** Human-readable slot, e.g. "Mon · 8:30 – 9:30 AM". */
  slotLabel: string;
  /** Grade-scoped subjects to choose from. */
  subjects: { id: string; name: string; code: string }[];
  /** Teacher names typed by the master. */
  teachers: { id: string; name: string; code: string | null }[];
  listsPending: boolean;
  listsError: boolean;
  /** Current cell content, if the slot is already filled. */
  initial: SlotValue | null;
  saving: boolean;
  removing: boolean;
  error: string | null;
  /** One-teacher-per-subject owners in this section, excluding the slot being
   * edited: subjectId -> teacherIds already holding that subject elsewhere.
   * When a subject has exactly one owner the teacher picker locks to it; when
   * it has several the slot cannot be saved until the subject is unified
   * (clear its slots first). A teacher may still own several subjects. */
  subjectTeacherMap?: Record<string, string[]>;
  onClose: () => void;
  onSave: (subjectId: string, teacherNameId: string) => void;
  onRemove: () => void;
  /** Swap to the standalone creation modals when a list is empty. */
  onAddTeacher: () => void;
  onAddSubject: () => void;
};

// Single per-slot entry modal: subject and teacher dropdowns together.
// Record creation lives in the page-level catalog cards — pick here,
// create there.
export function SlotEntryDialog({
  sectionName,
  gradeLevel,
  slotLabel,
  subjects,
  teachers,
  listsPending,
  listsError,
  initial,
  saving,
  removing,
  error,
  subjectTeacherMap,
  onClose,
  onSave,
  onRemove,
  onAddTeacher,
  onAddSubject,
}: Props) {
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? "");
  const [teacherNameId, setTeacherNameId] = useState(initial?.teacherNameId ?? "");

  // One subject takes one teacher per section — but a teacher may own
  // several subjects. Owners exclude the slot being edited, so retaking a
  // subject's last slot still swaps its teacher cleanly.
  const owners = (subjectTeacherMap?.[subjectId] ?? []).filter(Boolean);
  const uniqueOwners = Array.from(new Set(owners));
  const lockedTeacherId = uniqueOwners.length === 1 ? uniqueOwners[0] : null;
  const isSplit = uniqueOwners.length > 1;
  const selectedSubject = subjects.find((s) => s.id === subjectId);
  const lockedTeacher = teachers.find((t) => t.id === lockedTeacherId);
  const splitNames = uniqueOwners
    .map((id) => teachers.find((t) => t.id === id)?.name ?? "another teacher")
    .join(", ");

  // When the subject changes to one that already has an owner in this
  // section, pin the teacher picker to that owner.
  useEffect(() => {
    if (lockedTeacherId && lockedTeacherId !== teacherNameId) {
      setTeacherNameId(lockedTeacherId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, lockedTeacherId]);

  const canSave =
    subjectId !== "" &&
    teacherNameId !== "" &&
    !saving &&
    !listsPending &&
    !isSplit &&
    (!lockedTeacherId || teacherNameId === lockedTeacherId);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule slot</DialogTitle>
          <DialogDescription>
            {sectionName} · {slotLabel} · Grade {gradeLevel.replace("G", "")}
          </DialogDescription>
        </DialogHeader>

        {listsPending ? (
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading options">
            <div className="h-9 rounded-md bg-muted" />
            <div className="h-9 rounded-md bg-muted" />
          </div>
        ) : listsError ? (
          <p role="alert" className="text-sm text-destructive">
            Could not load subjects or teachers.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Subject</span>
              {subjects.length === 0 ? (
                <div className="flex flex-col items-start gap-2">
                  <p className="text-sm text-muted-foreground">
                    No subjects for this grade yet — add them first.
                  </p>
                  <Button variant="outline" size="sm" onClick={onAddSubject}>
                    <Plus size={14} aria-hidden />
                    Add subjects
                  </Button>
                </div>
              ) : (
                <DropdownSelect
                  value={subjectId}
                  onValueChange={setSubjectId}
                  options={subjects.map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }))}
                  placeholder="Pick a subject…"
                  ariaLabel="Subject"
                />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Teacher</span>
              {teachers.length === 0 ? (
                <div className="flex flex-col items-start gap-2">
                  <p className="text-sm text-muted-foreground">
                    No teacher names yet — add them first.
                  </p>
                  <Button variant="outline" size="sm" onClick={onAddTeacher}>
                    <Plus size={14} aria-hidden />
                    Add teachers
                  </Button>
                </div>
              ) : lockedTeacherId && lockedTeacher ? (
                <div
                  className="flex items-center justify-between gap-2 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm"
                  aria-live="polite"
                >
                  <span>
                    {lockedTeacher.code
                      ? `${lockedTeacher.name} (${lockedTeacher.code})`
                      : lockedTeacher.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Owns {selectedSubject?.name ?? "this subject"} here
                  </span>
                </div>
              ) : (
                <DropdownSelect
                  value={teacherNameId}
                  onValueChange={setTeacherNameId}
                  options={teachers.map((t) => ({
                    value: t.id,
                    label: t.code ? `${t.name} (${t.code})` : t.name,
                  }))}
                  placeholder="Pick a teacher…"
                  ariaLabel="Teacher"
                />
              )}
              {subjectId !== "" && lockedTeacherId && lockedTeacher ? (
                <p className="text-xs text-muted-foreground">
                  {selectedSubject?.name ?? "This subject"} in {sectionName} is handled by{" "}
                  {lockedTeacher.name} — one subject takes one teacher per section. To
                  reassign it, clear its slots first. A teacher may still handle
                  several subjects.
                </p>
              ) : null}
              {isSplit ? (
                <p role="alert" className="text-xs text-destructive">
                  {selectedSubject?.name ?? "This subject"} in {sectionName} is split across{" "}
                  {splitNames} — clear its slots to unify it to one teacher before
                  adding more.
                </p>
              ) : null}
            </div>
          </div>
        )}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          {initial ? (
            <Button
              variant="destructive"
              onClick={onRemove}
              disabled={removing || saving}
              aria-busy={removing || undefined}
            >
              {removing ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  <span aria-live="polite">Removing…</span>
                </>
              ) : (
                "Remove"
              )}
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (subjectId !== "" && teacherNameId !== "") onSave(subjectId, teacherNameId);
            }}
            disabled={!canSave}
            aria-busy={saving || undefined}
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden />
                <span aria-live="polite">Saving…</span>
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
