"use client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import { SlotEntryDialog, type SlotValue } from "./SlotEntryDialog";
import { AddSubjectDialog, AddTeacherDialog } from "./CatalogCards";
import type { ScheduleSubject, ScheduleSection } from "../page";
import type { CatalogTeacher } from "./use-schedule-catalog";
interface Props {
  section: ScheduleSection;
  noteOpen: boolean;
  reviewNote: string | null;
  onCloseNote: () => void;
  confirmUnlockOpen: boolean;
  unlockPending: boolean;
  onCloseUnlock: () => void;
  onConfirmUnlock: () => void;
  confirmClearOpen: boolean;
  filledCount: number;
  removeAllPending: boolean;
  onCloseClear: () => void;
  onConfirmClear: () => void;
  slotModal: { day: number; period: number } | null;
  slotLabel: string;
  gradeSubjects: ScheduleSubject[];
  teachers: CatalogTeacher[];
  listsPending: boolean;
  listsError: boolean;
  modalInitial: SlotValue | null;
  saving: boolean;
  removing: boolean;
  slotError: string | null;
  subjectTeacherMap: Record<string, string[]>;
  onCloseSlot: () => void;
  onSaveSlot: (subjectId: string, teacherNameId: string) => void;
  onRemoveSlot: () => void;
  onAddTeacher: () => void;
  onAddSubject: () => void;
  createTeacherOpen: boolean;
  onCloseCreateTeacher: () => void;
  createSubjectOpen: boolean;
  onCloseCreateSubject: () => void;
  allSubjects: ScheduleSubject[];
}
export function ScheduleConfirmModals({
  section,
  noteOpen,
  reviewNote,
  onCloseNote,
  confirmUnlockOpen,
  unlockPending,
  onCloseUnlock,
  onConfirmUnlock,
  confirmClearOpen,
  filledCount,
  removeAllPending,
  onCloseClear,
  onConfirmClear,
  slotModal,
  slotLabel,
  gradeSubjects,
  teachers,
  listsPending,
  listsError,
  modalInitial,
  saving,
  removing,
  slotError,
  subjectTeacherMap,
  onCloseSlot,
  onSaveSlot,
  onRemoveSlot,
  onAddTeacher,
  onAddSubject,
  createTeacherOpen,
  onCloseCreateTeacher,
  createSubjectOpen,
  onCloseCreateSubject,
  allSubjects,
}: Props) {
  return (
    <>
      {noteOpen && reviewNote ? (
        <CardModal
          open
          onClose={onCloseNote}
          size="md"
          title="Principal requested changes"
          description={
            <>Sent back for revision — full message for {section.name}.</>
          }
        >
          <p className="max-h-64 overflow-y-auto text-sm break-words whitespace-pre-wrap">
            {reviewNote}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCloseNote}>
              Close
            </Button>
          </div>
        </CardModal>
      ) : null}
      {confirmUnlockOpen ? (
        <CardModal
          open
          onClose={() => {
            if (!unlockPending) onCloseUnlock();
          }}
          dismissable={!unlockPending}
          size="sm"
          title="Unlock schedule for editing?"
          description={
            <>
              All {section.timetableEntries.length} approved slot
              {section.timetableEntries.length === 1 ? "" : "s"} for {section.name} return
              to draft. The timetable stays visible but stops being official until the
              principal approves it again.
            </>
          }
        >
          <div className="flex justify-end gap-2">
            <Button variant="destructive" onClick={onCloseUnlock} disabled={unlockPending}>
              Cancel
            </Button>
            <Button
              onClick={onConfirmUnlock}
              disabled={unlockPending}
              aria-busy={unlockPending || undefined}
            >
              {unlockPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  <span aria-live="polite">Unlocking…</span>
                </>
              ) : (
                "Unlock schedule"
              )}
            </Button>
          </div>
        </CardModal>
      ) : null}
      {confirmClearOpen ? (
        <CardModal
          open
          onClose={() => {
            if (!removeAllPending) onCloseClear();
          }}
          dismissable={!removeAllPending}
          size="sm"
          title="Remove all entries?"
          description={
            <>
              This clears all {filledCount} scheduled slot{filledCount === 1 ? "" : "s"} for{" "}
              {section.name}. Subjects and teacher names stay in their lists.
            </>
          }
        >
          <div className="flex justify-end gap-2">
            <Button variant="destructive" onClick={onCloseClear} disabled={removeAllPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirmClear}
              disabled={removeAllPending}
              aria-busy={removeAllPending || undefined}
            >
              {removeAllPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  <span aria-live="polite">Removing…</span>
                </>
              ) : (
                "Remove all"
              )}
            </Button>
          </div>
        </CardModal>
      ) : null}
      {slotModal ? (
        <SlotEntryDialog
          sectionName={section.name}
          gradeLevel={section.gradeLevel}
          slotLabel={slotLabel}
          subjects={gradeSubjects}
          teachers={teachers}
          listsPending={listsPending}
          listsError={listsError}
          initial={modalInitial}
          saving={saving}
          removing={removing}
          error={slotError}
          subjectTeacherMap={subjectTeacherMap}
          onClose={onCloseSlot}
          onSave={onSaveSlot}
          onRemove={onRemoveSlot}
          onAddTeacher={onAddTeacher}
          onAddSubject={onAddSubject}
        />
      ) : null}
      {createTeacherOpen ? (
        <AddTeacherDialog
          onClose={onCloseCreateTeacher}
          teachers={teachers}
        />
      ) : null}
      {createSubjectOpen ? (
        <AddSubjectDialog
          onClose={onCloseCreateSubject}
          subjects={allSubjects}
          teachers={teachers}
        />
      ) : null}
    </>
  );
}
