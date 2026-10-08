"use client";
import { useState } from "react";
import { usePersistedRail } from "@/hooks/use-persisted-rail";
import Link from "next/link";
import { ArrowLeft, PanelRightClose, PanelRightOpen, Pencil, Trash2 } from "lucide-react";
import { useTerm } from "@/lib/term/TermContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WEEK_LABELS_SHORT } from "@/services/teacher/schedule";
import { buildTimetable, formatRange } from "./schedule-time";
import { useScheduleCatalog } from "./use-schedule-catalog";
import { cellKey, useScheduleCells } from "./use-schedule-cells";
import { ScheduleGrid } from "./schedule-grid";
import { ScheduleRail } from "./schedule-rail";
import { ScheduleConfirmModals } from "./schedule-confirm-modals";
import type { ScheduleSection } from "../page";
type Props = {
  section: ScheduleSection;
};
export function ScheduleWeekSetup({ section }: Props) {
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const catalog = useScheduleCatalog(termKey);
  const cellsHook = useScheduleCells(section, {
    subjectById: catalog.subjectById,
    teacherById: catalog.teacherById,
  });
  const [railOpen, setRailOpen] = usePersistedRail("zentra.schedule-rail", true);
  const [noteOpen, setNoteOpen] = useState(false);
  const [createTeacherOpen, setCreateTeacherOpen] = useState(false);
  const [createSubjectOpen, setCreateSubjectOpen] = useState(false);
  const gradeSubjects = catalog.subjects.filter(
    (s) => s.gradeLevel === section.gradeLevel,
  );
  const activeConfig = catalog.activeConfig;
  if (!activeConfig) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading timetable" aria-hidden>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr>
                <th scope="col" className="w-28 p-2">
                  <Skeleton className="h-4 w-16" />
                </th>
                {[0, 1, 2, 3, 4].map((d) => (
                  <th key={d} scope="col" className="p-2">
                    <Skeleton className="mx-auto h-4 w-10" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((r) => (
                <tr key={r}>
                  <th scope="row" className="border-t p-2">
                    <Skeleton className="h-3 w-20" />
                  </th>
                  {[0, 1, 2, 3, 4].map((d) => (
                    <td key={d} className="border-t p-1">
                      <Skeleton className="min-h-14 w-full rounded-md" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  const rows = buildTimetable(activeConfig);
  const slotModal = cellsHook.slotModal;
  const modalRow = slotModal
    ? rows.find((r) => r.kind === "period" && r.periodIndex === slotModal.period)
    : undefined;
  const modalLabel =
    cellsHook.slotModal && modalRow && modalRow.kind === "period"
      ? `${WEEK_LABELS_SHORT[cellsHook.slotModal.day - 1]} · ${formatRange(modalRow.startMin, modalRow.endMin)}`
      : "";
  const modalInitial = cellsHook.slotModal ? (cellsHook.cells[cellKey(cellsHook.slotModal.day, cellsHook.slotModal.period)] ?? null) : null;
  return (
    <div
      className={`grid items-start gap-4 transition-[grid-template-columns] duration-300 ease-out motion-reduce:transition-none ${
        railOpen ? "lg:grid-cols-[minmax(0,1fr)_17rem]" : "lg:grid-cols-[minmax(0,1fr)_0rem]"
      }`}
    >
      <div className="flex min-w-0 flex-col gap-5">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/teacher/schedule">
              <ArrowLeft size={16} aria-hidden />
              Sections
            </Link>
          </Button>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">
                Schedule for {section.name}
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setRailOpen((v) => !v)}
                aria-label={railOpen ? "Hide sidebar" : "Show sidebar"}
                title={railOpen ? "Hide sidebar" : "Show sidebar"}
                aria-expanded={railOpen}
              >
                {railOpen ? (
                  <PanelRightClose size={16} aria-hidden />
                ) : (
                  <PanelRightOpen size={16} aria-hidden />
                )}
              </Button>
              {cellsHook.isLocked ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cellsHook.setConfirmUnlockOpen(true)}
                  disabled={cellsHook.unlock.isPending}
                >
                  <Pencil size={16} aria-hidden />
                  Edit schedule
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => cellsHook.setConfirmClearOpen(true)}
                  disabled={cellsHook.filledCount === 0 || cellsHook.removeAll.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 size={16} aria-hidden />
                  Remove all
                </Button>
              )}
            </div>
          </div>
        </div>
        <ScheduleGrid
          rows={rows}
          cells={cellsHook.cells}
          subjectById={catalog.subjectById}
          teacherById={catalog.teacherById}
          copied={cellsHook.copied}
          isLocked={cellsHook.isLocked}
          splitSubjects={cellsHook.splitSubjects}
          sectionName={section.name}
          listsError={catalog.subjectsQuery.isError || catalog.teachersQuery.isError}
          statusOf={cellsHook.statusOf}
          serverHasReviewNote={(key) => !!cellsHook.serverStatus.get(key)?.reviewNote}
          onEdit={(day, period) => {
            cellsHook.setSlotModal({ day, period });
            cellsHook.setSlotError(null);
          }}
          onPaste={(day, period) => {
            if (cellsHook.copied) {
              cellsHook.pasteCell(day, period);
            } else {
              cellsHook.setSlotModal({ day, period });
              cellsHook.setSlotError(null);
            }
          }}
          onCopy={(subjectId, teacherNameId) => cellsHook.copyCell(subjectId, teacherNameId)}
        />
      </div>
      <div className="hidden min-w-0 overflow-hidden lg:block" inert={!railOpen}>
        <ScheduleRail
          railOpen={railOpen}
          hasSubmitted={cellsHook.hasSubmitted}
          reviewNote={cellsHook.reviewNote}
          hasDraft={cellsHook.hasDraft}
          entriesLength={section.timetableEntries.length}
          sectionName={section.name}
          copied={cellsHook.copied}
          onClearCopied={() => cellsHook.setCopied(null)}
          onReadMessage={() => setNoteOpen(true)}
          subjects={catalog.subjects}
          teachers={catalog.teachers}
          subjectsPending={catalog.subjectsQuery.isPending}
          subjectsError={catalog.subjectsQuery.isError}
          teachersPending={catalog.teachersQuery.isPending}
          teachersError={catalog.teachersQuery.isError}
        />
      </div>
      <ScheduleConfirmModals
        section={section}
        noteOpen={noteOpen}
        reviewNote={cellsHook.reviewNote}
        onCloseNote={() => setNoteOpen(false)}
        confirmUnlockOpen={cellsHook.confirmUnlockOpen}
        unlockPending={cellsHook.unlock.isPending}
        onCloseUnlock={() => cellsHook.setConfirmUnlockOpen(false)}
        onConfirmUnlock={() => cellsHook.unlock.mutate()}
        confirmClearOpen={cellsHook.confirmClearOpen}
        filledCount={cellsHook.filledCount}
        removeAllPending={cellsHook.removeAll.isPending}
        onCloseClear={() => cellsHook.setConfirmClearOpen(false)}
        onConfirmClear={() => cellsHook.removeAll.mutate()}
        slotModal={cellsHook.slotModal}
        slotLabel={modalLabel}
        gradeSubjects={gradeSubjects}
        teachers={catalog.teachers}
        listsPending={catalog.subjectsQuery.isPending || catalog.teachersQuery.isPending}
        listsError={catalog.subjectsQuery.isError || catalog.teachersQuery.isError}
        modalInitial={modalInitial}
        saving={cellsHook.saveSlot.isPending}
        removing={cellsHook.removeSlot.isPending}
        slotError={cellsHook.slotError}
        subjectTeacherMap={cellsHook.dialogSubjectTeacherMap}
        onCloseSlot={() => cellsHook.setSlotModal(null)}
        onSaveSlot={cellsHook.handleSlotSave}
        onRemoveSlot={cellsHook.handleSlotRemove}
        onAddTeacher={() => {
          cellsHook.setSlotModal(null);
          setCreateTeacherOpen(true);
        }}
        onAddSubject={() => {
          cellsHook.setSlotModal(null);
          setCreateSubjectOpen(true);
        }}
        createTeacherOpen={createTeacherOpen}
        onCloseCreateTeacher={() => setCreateTeacherOpen(false)}
        createSubjectOpen={createSubjectOpen}
        onCloseCreateSubject={() => setCreateSubjectOpen(false)}
        allSubjects={catalog.subjects}
      />
    </div>
  );
}
