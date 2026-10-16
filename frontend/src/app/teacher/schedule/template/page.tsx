"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, Gauge } from "lucide-react";
import { useTerm } from "@/lib/term/TermContext";
import { apiClient } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/useSession";
import { useTeacherOverview } from "@/services/teacher/overview.service";
import { useCachedMasterTeacher } from "@/services/teacher/flagCache";
import { useTeacherInvalidate } from "../../components/use-teacher-invalidate";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { TeacherPageHeader } from "../../components/TeacherPageHeader";
import { TemplateCatalogBoards } from "../components/TemplateCatalogBoards";
import { SubjectCatalogKanban } from "../components/subject-catalog-kanban";
import { TeacherCatalogKanban } from "../components/teacher-catalog-kanban";
import { TEACHER_CREATE_STEPS, TeacherCreateDockRows } from "../components/teacher-add-kanban";
import type { TeacherCreateProgress } from "../components/use-add-teachers";
import { TEACHER_DELETE_STEPS, TeacherDeleteDockRows } from "../components/teacher-delete-kanban";
import type { TeacherDeleteProgress } from "../components/teacher-delete-kanban";
import { TemplateConfigBoards } from "../components/TemplateConfigBoards";
import { DropdownSelect } from "@/app/principal/academics/assign/components/DropdownSelect";
import dropdownStyles from "@/app/principal/academics/assign/components/dropdown-select.module.css";
import stepperStyles from "../components/template-stepper.module.css";
import {
  CONFIG_SAVE_STEPS,
  ConfigDockRows,
  describeConfig,
  ScheduleConfigKanban,
  type ConfigSaveProgress,
} from "../components/schedule-config-kanban";
import { SUBMIT_STEPS, SendToPrincipalKanban, SubmitDockRows, type SubmitProgress } from "../components/schedule-submit-kanban";
import { buildTimetable, workloadOf, type DayConfig } from "../components/schedule-time";
import { useScheduleCatalog } from "../components/use-schedule-catalog";
import { cellKey, useScheduleCells } from "../components/use-schedule-cells";
import { ScheduleTemplateGrid } from "../components/ScheduleTemplateGrid";
import { useScheduleConflicts } from "../components/use-schedule-conflicts";
import { useTemplateWorkload } from "../components/use-template-workload";
import { ProgressDock } from "@/components/ui/progress-dock";
import { ConflictsDock } from "../components/conflicts-dock";
import type { SubjectCreateProgress } from "../components/use-add-subjects";
import { DELETE_STEPS, DeleteDockRows, type SubjectDeleteProgress } from "../components/subject-delete-kanban";
import kanbanStyles from "../components/subject-kanban.module.css";
import type { ScheduleSection } from "../page";

const STEPS = [
  { label: "Teachers & subjects", target: 0 },
  { label: "Day configuration", target: 1 },
  { label: "Send to principal", target: 3 },
] as const;

function sectionLabel(name: string, gradeLevel: string) {
  return (
    <span className={dropdownStyles.optionLabel}>
      <span className={dropdownStyles.optionName}>{name}</span>
      <span className={dropdownStyles.gradePill}>Grade {gradeLevel.replace("G", "")}</span>
    </span>
  );
}

function TemplateInner() {
  const searchParams = useSearchParams();
  const initialSectionId = searchParams.get("sectionId") ?? "";
  const viewParam = searchParams.get("view") ?? "";
  const [sectionId, setSectionId] = useState(initialSectionId);
  const [configExpanded, setConfigExpanded] = useState(viewParam === "config");
  const [configProgress, setConfigProgress] = useState<ConfigSaveProgress | null>(null);
  const [submitProgress, setSubmitProgress] = useState<SubmitProgress | null>(null);
  const [tabsTapped, setTabsTapped] = useState(viewParam !== "");
  const [boardsOpen, setBoardsOpen] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [subjectsExpanded, setSubjectsExpanded] = useState(
    viewParam === "add-subject" || viewParam === "subjects",
  );
  const [kanbanAddOpen, setKanbanAddOpen] = useState(viewParam === "add-subject");
  const [addOnly, setAddOnly] = useState(viewParam === "add-subject");
  const [teachersExpanded, setTeachersExpanded] = useState(
    viewParam === "add-teacher" || viewParam === "teachers",
  );
  const [teacherKanbanAddOpen, setTeacherKanbanAddOpen] = useState(viewParam === "add-teacher");
  const [teacherAddOnly, setTeacherAddOnly] = useState(viewParam === "add-teacher");
  const [step, setStep] = useState(
    viewParam === "send" ? 3 : viewParam === "config" ? 1 : initialSectionId ? 2 : 0,
  );
  // Deep-link sync (?sectionId=… / ?view=…): runs once per param change, not per render.
  /* eslint-disable react-hooks/set-state-in-effect -- deep-link landing sync */
  useEffect(() => {
    if (initialSectionId) {
      setSectionId(initialSectionId);
      if (!viewParam) setStep(2);
    }
  }, [initialSectionId, viewParam]);
  useEffect(() => {
    if (!viewParam) return;
    setTabsTapped(true);
    if (viewParam === "add-subject") {
      setTeachersExpanded(false);
      setTeacherKanbanAddOpen(false);
      setTeacherAddOnly(false);
      setConfigExpanded(false);
      setSubjectsExpanded(true);
      setAddOnly(true);
      setKanbanAddOpen(true);
      setStep(0);
    } else if (viewParam === "subjects") {
      setTeachersExpanded(false);
      setTeacherKanbanAddOpen(false);
      setTeacherAddOnly(false);
      setConfigExpanded(false);
      setSubjectsExpanded(true);
      setKanbanAddOpen(false);
      setAddOnly(false);
      setStep(0);
    } else if (viewParam === "add-teacher") {
      setSubjectsExpanded(false);
      setKanbanAddOpen(false);
      setAddOnly(false);
      setConfigExpanded(false);
      setTeachersExpanded(true);
      setTeacherAddOnly(true);
      setTeacherKanbanAddOpen(true);
      setStep(0);
    } else if (viewParam === "teachers") {
      setSubjectsExpanded(false);
      setKanbanAddOpen(false);
      setAddOnly(false);
      setConfigExpanded(false);
      setTeachersExpanded(true);
      setTeacherKanbanAddOpen(false);
      setTeacherAddOnly(false);
      setStep(0);
    } else if (viewParam === "config") {
      setSubjectsExpanded(false);
      setKanbanAddOpen(false);
      setAddOnly(false);
      setTeachersExpanded(false);
      setTeacherKanbanAddOpen(false);
      setTeacherAddOnly(false);
      setConfigExpanded(true);
      setStep(1);
    } else if (viewParam === "send") {
      setSubjectsExpanded(false);
      setKanbanAddOpen(false);
      setAddOnly(false);
      setTeachersExpanded(false);
      setTeacherKanbanAddOpen(false);
      setTeacherAddOnly(false);
      setConfigExpanded(false);
      setStep(3);
    }
  }, [viewParam]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const [createProgress, setCreateProgress] = useState<SubjectCreateProgress | null>(null);
  const [deleteProgress, setDeleteProgress] = useState<SubjectDeleteProgress | null>(null);
  const [teacherCreateProgress, setTeacherCreateProgress] = useState<TeacherCreateProgress | null>(null);
  const [teacherDeleteProgress, setTeacherDeleteProgress] = useState<TeacherDeleteProgress | null>(null);

  const handleSubjectsExpandedChange = (expanded: boolean) => {
    setSubjectsExpanded(expanded);
    // See-all path shows the grade grid only; the add form stays shut unless picked.
    setKanbanAddOpen(false);
    setAddOnly(false);
    if (expanded) {
      setTeachersExpanded(false);
      setTeacherKanbanAddOpen(false);
      setTeacherAddOnly(false);
      setConfigExpanded(false);
    }
  };

  const handleTeachersExpandedChange = (expanded: boolean) => {
    setTeachersExpanded(expanded);
    // See-all path shows the teacher list only; the add form stays shut unless picked.
    setTeacherKanbanAddOpen(false);
    setTeacherAddOnly(false);
    if (expanded) {
      setSubjectsExpanded(false);
      setKanbanAddOpen(false);
      setAddOnly(false);
      setConfigExpanded(false);
    }
  };

  const handleAddSubject = () => {
    // Add-subject path shows just the form card — no grade grid unless See all was picked.
    setSubjectsExpanded(true);
    setAddOnly(true);
    setKanbanAddOpen(true);
  };

  const handleAddTeacher = () => {
    // Add-teacher path shows just the form card — no teacher list unless See all was picked.
    setTeachersExpanded(true);
    setTeacherAddOnly(true);
    setTeacherKanbanAddOpen(true);
  };

  const handleKanbanAddOpenChange = (open: boolean) => {
    setKanbanAddOpen(open);
    // In add-only mode, closing the form returns to the catalog cards.
    if (!open && addOnly) {
      setSubjectsExpanded(false);
      setAddOnly(false);
    }
  };

  const handleTeacherKanbanAddOpenChange = (open: boolean) => {
    setTeacherKanbanAddOpen(open);
    // In add-only mode, closing the form returns to the catalog cards.
    if (!open && teacherAddOnly) {
      setTeachersExpanded(false);
      setTeacherAddOnly(false);
    }
  };

  const collapseSubjectsView = () => {
    setSubjectsExpanded(false);
    setKanbanAddOpen(false);
    setAddOnly(false);
  };

  const collapseTeachersView = () => {
    setTeachersExpanded(false);
    setTeacherKanbanAddOpen(false);
    setTeacherAddOnly(false);
  };

  const collapseCatalogViews = () => {
    collapseSubjectsView();
    collapseTeachersView();
    setConfigExpanded(false);
  };

  const session = useSession();
  const overview = useTeacherOverview();
  const cachedMaster = useCachedMasterTeacher(session?.sub);
  const isMasterTeacher = overview.data?.isMasterTeacher ?? cachedMaster;
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const invalidateTeacher = useTeacherInvalidate();

  const catalog = useScheduleCatalog(termKey);
  const { workload, setWorkload } = useTemplateWorkload(termKey);
  // Catalog-only visits (See all / Add / Configure from the schedule gutter)
  // don't need the grid — skip the heavy workspace-wide fetches until the
  // grid or send views actually open.
  const catalogOpen = subjectsExpanded || teachersExpanded || configExpanded;
  const needsGrid = step === 2 || step === 3;
  const conflicts = useScheduleConflicts(termKey, workload, { enabled: needsGrid });

  const sectionsQuery = useQuery<{ sections: ScheduleSection[] }>({
    queryKey: ["teacher-schedule-section", "template", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ sections: ScheduleSection[] }>("/api/teacher/schedule");
      return data;
    },
    enabled: isMasterTeacher && !catalogOpen,
  });

  const sections = useMemo(() => sectionsQuery.data?.sections ?? [], [sectionsQuery.data]);
  const section = sections.find((s) => s.id === sectionId) ?? null;

  const cellsHook = useScheduleCells(
    section ?? { id: "__template__", name: "", gradeLevel: "G7", timetableEntries: [] } as unknown as ScheduleSection,
    { subjectById: catalog.subjectById, teacherById: catalog.teacherById },
    { silent: true, persistKey: `zentra.schedule-template-cells:${termKey}:${sectionId}` },
  );
  const stagedKeys = useMemo(
    () => new Set(cellsHook.pendingSlots.map((p) => p.key)),
    [cellsHook.pendingSlots],
  );

  const configMutation = useMutation({
    mutationFn: async (next: DayConfig) => {
      const { workload: nextWorkload, ...dayShape } = next;
      if (nextWorkload) setWorkload(nextWorkload);
      const { data } = await apiClient.patch<{ config: DayConfig }>("/api/teacher/schedule/config", dayShape);
      return data.config;
    },
    onSuccess: () => {
      setConfigExpanded(false);
      invalidateTeacher.schedule();
      setConfigProgress((prev) =>
        prev ? { ...prev, active: false, done: true, status: "saved" } : prev,
      );
      toast.success({ title: "School day saved", description: "Template reshaped itself." });
    },
    onError: (err: unknown) => {
      const message = apiErrorMessage(err, "Failed to save school-day shape.");
      setConfigProgress((prev) =>
        prev ? { ...prev, active: false, done: true, status: "failed", message } : prev,
      );
      toast.error({ title: "Could not save school day", description: message });
    },
  });

  const handleConfigApply = (next: DayConfig) => {
    // Low latency: the dock opens this tick with the applied snapshot while
    // the PATCH confirms in the background.
    const { items, summary } = describeConfig(next);
    setConfigProgress({ active: true, done: false, status: "saving", items, summary });
    configMutation.mutate(next);
  };

  // Catalog forms (See all / Add / Configure) render as soon as the small
  // catalog queries land — they never wait for the full sections payload or
  // the workspace-wide conflict scan. The grid and send views keep the old
  // gate and fetch those on demand.
  const masterKnown = overview.data?.isMasterTeacher !== undefined || cachedMaster;
  if (!masterKnown) {
    return (
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-5" aria-busy="true" aria-label="Loading template">
        <p className="text-sm text-muted-foreground">Loading schedule template…</p>
      </section>
    );
  }

  if (!isMasterTeacher) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <h1 className="text-2xl font-semibold tracking-tight">Schedule template</h1>
        <p className="text-sm text-muted-foreground">Only Master Teachers can use the schedule template.</p>
      </section>
    );
  }

  if (sectionsQuery.isLoading && !catalogOpen) {
    return (
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-5" aria-busy="true" aria-label="Loading template">
        <p className="text-sm text-muted-foreground">Loading schedule template…</p>
      </section>
    );
  }

  const gradeSubjects = section
    ? catalog.subjects.filter((s) => s.gradeLevel === section.gradeLevel)
    : catalog.subjects;
  const activeConfig = catalog.activeConfig;
  const rows = activeConfig ? buildTimetable({ ...activeConfig, workload }) : [];
  const caps = workloadOf(activeConfig);

  const handleTemplateChange = (day: number, period: number, subjectId: string, teacherNameId: string) => {
    if (!section) return;
    // Low latency: stage instantly in the grid (persisted locally), no toast,
    // no waiting — the Save button flushes staged slots with a progress dock.
    const key = cellKey(day, period);
    cellsHook.setCells((prev) => ({
      ...prev,
      [key]: { subjectId, teacherNameId: teacherNameId === "" ? null : teacherNameId },
    }));
    cellsHook.setSlotError(null);
  };

  const handleTemplateClear = (day: number, period: number) => {
    if (!section) return;
    const key = cellKey(day, period);
    if ((cellsHook.cells[key] ?? null) === null) return;
    cellsHook.setCells((prev) => ({ ...prev, [key]: null }));
    cellsHook.removeSlot.mutate({ day, period, key });
  };

  return (
    <section className="flex w-full flex-col gap-5">
      <Button asChild variant="ghost" size="sm" className="h-6 px-2 text-xs self-start -ml-2">
        <Link href="/teacher/schedule">
          <ArrowLeft size={16} aria-hidden />
          Back to schedule
        </Link>
      </Button>
      <TeacherPageHeader
        title="Schedule template"
        description="Generic per-section builder. Add teachers and subjects, configure the day, then fill each cell. One subject takes one teacher per section; double-books save with a warning."
        actions={
          <div className="flex w-full min-w-0 flex-col items-stretch gap-2 lg:w-auto lg:min-w-[36rem] lg:max-w-[44rem]">
            <div className="flex flex-wrap items-center gap-1.5 self-end">
              <span className={stepperStyles.hintLabel} aria-hidden>
                Tap a tab to switch view
              </span>
              <ol className="flex flex-wrap items-center gap-1.5" aria-label="Template tabs">
                {STEPS.map((s, i) => (
                  <li key={s.label} className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setStep(s.target);
                        setTabsTapped(true);
                        collapseCatalogViews();
                      }}
                      aria-current={step === s.target ? "step" : undefined}
                      title={`Go to ${s.label}`}
                      className={`${stepperStyles.pill} ${step === s.target ? stepperStyles.pillCurrent : ""} ${tabsTapped ? "" : stepperStyles.hint}`}
                    >
                      {step > s.target ? <Check size={12} aria-hidden /> : <span aria-hidden>{i + 1}</span>}
                      {s.label}
                    </button>
                    {s.target < STEPS.length - 1 ? <ArrowRight size={12} aria-hidden className="text-muted-foreground" /> : null}
                  </li>
                ))}
              </ol>
              {step === 2 ? (
                <button
                  type="button"
                  onClick={() => setBoardsOpen((v) => !v)}
                  aria-expanded={boardsOpen}
                  title={boardsOpen ? "Hide catalog cards" : "Show catalog cards"}
                  className={`${stepperStyles.pill} ${boardsOpen ? stepperStyles.pillCurrent : ""}`}
                >
                  Catalog
                  <ChevronDown
                    size={12}
                    aria-hidden
                    className={`transition-transform duration-150 ease-out ${boardsOpen ? "rotate-180" : ""}`}
                  />
                </button>
              ) : null}
            </div>
            <div
              className={`${stepperStyles.boardsCollapse} ${step === 2 && !boardsOpen ? stepperStyles.boardsCollapsed : ""} ${subjectsExpanded || teachersExpanded || configExpanded || step === 3 ? stepperStyles.boardsCollapsed : ""}`}
              aria-hidden={(step === 2 && !boardsOpen) || subjectsExpanded || teachersExpanded || configExpanded || step === 3}
            >
              <div className={stepperStyles.boardsInner}>
                {step === 1 ? (
                  <TemplateConfigBoards
                    config={activeConfig}
                    maxDaily={caps.maxDailyPeriods}
                    maxWeekly={caps.maxWeeklyPeriods}
                    onConfigure={() => setConfigExpanded(true)}
                  />
                ) : step === 3 || subjectsExpanded || teachersExpanded || configExpanded ? null : (
                  <TemplateCatalogBoards
                    subjects={catalog.subjects}
                    teachers={catalog.teachers}
                    subjectsPending={catalog.subjectsQuery.isPending}
                    teachersPending={catalog.teachersQuery.isPending}
                    subjectsError={catalog.subjectsQuery.isError}
                    teachersError={catalog.teachersQuery.isError}
                    subjectsExpanded={false}
                    onSubjectsExpandedChange={handleSubjectsExpandedChange}
                    onAddSubject={handleAddSubject}
                    teachersExpanded={false}
                    onTeachersExpandedChange={handleTeachersExpandedChange}
                    onAddTeacher={handleAddTeacher}
                  />
                )}
              </div>
            </div>
          </div>
        }
      />
      {subjectsExpanded && step !== 1 ? (
        <div className="flex w-full flex-col gap-4" aria-label="All subjects expanded view">
          <SubjectCatalogKanban
            subjects={catalog.subjects}
            pending={catalog.subjectsQuery.isPending}
            loadError={catalog.subjectsQuery.isError}
            onBack={collapseSubjectsView}
            addOpen={kanbanAddOpen}
            onAddOpenChange={handleKanbanAddOpenChange}
            showGrid={!addOnly}
            onCreateProgress={setCreateProgress}
            onDeleteProgress={setDeleteProgress}
          />
        </div>
      ) : null}
      {teachersExpanded && step !== 1 ? (
        <div className="flex w-full flex-col gap-4" aria-label="All teachers expanded view">
          <TeacherCatalogKanban
            teachers={catalog.teachers}
            pending={catalog.teachersQuery.isPending}
            loadError={catalog.teachersQuery.isError}
            onBack={collapseTeachersView}
            addOpen={teacherKanbanAddOpen}
            onAddOpenChange={handleTeacherKanbanAddOpenChange}
            showList={!teacherAddOnly}
            onCreateProgress={setTeacherCreateProgress}
            onDeleteProgress={setTeacherDeleteProgress}
          />
        </div>
      ) : null}
      {step === 0 ? (
        <div
          className={`${kanbanStyles.sectionCollapse} ${subjectsExpanded || teachersExpanded || configExpanded ? kanbanStyles.sectionCollapsed : ""}`}
          aria-hidden={subjectsExpanded || teachersExpanded || configExpanded}
        >
          <div className={`${kanbanStyles.sectionInner} mt-16 flex flex-col items-center gap-4`}>
          <div className="flex flex-col gap-1">
            <span className="text-left text-xs text-muted-foreground" id="template-section-label">
              Section for this template
            </span>
            <div className="flex items-center gap-2">
              <DropdownSelect
                value={sectionId}
                onValueChange={setSectionId}
                options={sections.map((s) => ({
                  value: s.id,
                  label: sectionLabel(s.name, s.gradeLevel),
                }))}
                placeholder="Pick a section…"
                ariaLabel="Section for this template"
                triggerClassName={dropdownStyles.dropdown32}
              />
              <Button size="sm" onClick={() => setStep(2)} disabled={catalog.subjects.length === 0 || catalog.teachers.length === 0 || !sectionId} className="h-6 px-2 text-xs">
                Continue
              </Button>
            </div>
          </div>
          {catalog.subjects.length === 0 || catalog.teachers.length === 0 ? (
            <p className="text-xs text-muted-foreground">Add at least one subject (with Core/Elective type) and one teacher to continue.</p>
          ) : null}
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div
          className={`${kanbanStyles.sectionCollapse} ${subjectsExpanded || teachersExpanded || configExpanded ? kanbanStyles.sectionCollapsed : ""}`}
          aria-hidden={subjectsExpanded || teachersExpanded || configExpanded}
        >
          <div className={`${kanbanStyles.sectionInner} mt-16 flex flex-col items-center gap-4`}>
          <div className="flex flex-col gap-1">
            <span className="text-left text-xs text-muted-foreground">
              Section for this template
            </span>
            <div className="flex items-center gap-2">
              <DropdownSelect
                value={sectionId}
                onValueChange={setSectionId}
                options={sections.map((s) => ({
                  value: s.id,
                  label: sectionLabel(s.name, s.gradeLevel),
                }))}
                placeholder="Pick a section…"
                ariaLabel="Section for this template"
                triggerClassName={dropdownStyles.dropdown32}
              />
              <Button size="sm" onClick={() => setStep(2)} disabled={!sectionId} className="h-6 px-2 text-xs">
                Continue
              </Button>
            </div>
          </div>
          </div>
        </div>
      ) : null}

      {configExpanded && activeConfig ? (
        <div className="flex w-full flex-col gap-4" aria-label="Configure school day expanded view">
          <ScheduleConfigKanban
            config={{ ...activeConfig, workload }}
            onClose={() => setConfigExpanded(false)}
            onApply={handleConfigApply}
            saving={configMutation.isPending}
          />
        </div>
      ) : null}

      {step === 3 ? (
        <div className="flex w-full flex-col gap-4" aria-label="Send to principal view">
          <SendToPrincipalKanban onSubmitProgress={setSubmitProgress} />
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Section</span>
              <span className="inline-flex w-48 max-w-full">
                <DropdownSelect
                  value={sectionId}
                  onValueChange={setSectionId}
                  options={sections.map((s) => ({
                    value: s.id,
                    label: sectionLabel(s.name, s.gradeLevel),
                  }))}
                  placeholder="Pick a section…"
                  ariaLabel="Section"
                  triggerClassName={dropdownStyles.dropdown32}
                />
              </span>
              {section && cellsHook.saveProgress?.active ? (
                <Button size="sm" disabled aria-busy className="h-6 px-2 text-xs">
                  Saving…
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => void cellsHook.saveAll()}
                  disabled={!section || cellsHook.pendingSlots.length === 0}
                  title={
                    cellsHook.pendingSlots.length === 0
                      ? "No unsaved changes — pick a subject and teacher to stage slots"
                      : `Save ${cellsHook.pendingSlots.length} staged slot${cellsHook.pendingSlots.length === 1 ? "" : "s"}`
                  }
                  className="h-6 px-2 text-xs"
                >
                  Save{cellsHook.pendingSlots.length > 0 ? ` (${cellsHook.pendingSlots.length})` : ""}
                </Button>
              )}
              {section && cellsHook.pendingSlots.length > 0 && !cellsHook.saveProgress?.active ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (!confirmClearAll) {
                      setConfirmClearAll(true);
                      setTimeout(() => setConfirmClearAll(false), 4000);
                      return;
                    }
                    setConfirmClearAll(false);
                    cellsHook.discardStaged();
                  }}
                  title="Discard staged picks and revert to last-saved state"
                  className="h-6 px-2 text-xs"
                >
                  {confirmClearAll ? "Confirm?" : "Clear all"}
                </Button>
              ) : null}
            </span>
            {conflicts.data ? (
              <span className="flex items-center gap-1.5" role="status">
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-sans text-xs font-medium text-amber-700 dark:text-amber-400">
                  <AlertTriangle size={12} aria-hidden className="text-amber-500" />
                  {conflicts.data.conflicts.length} double-book warning{conflicts.data.conflicts.length === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-sans text-xs font-medium text-amber-700 dark:text-amber-400">
                  <Gauge size={12} aria-hidden className="text-amber-500" />
                  {conflicts.data.workload.overDaily.length + conflicts.data.workload.overWeekly.length} overload warning
                  {conflicts.data.workload.overDaily.length + conflicts.data.workload.overWeekly.length === 1 ? "" : "s"}
                </span>
              </span>
            ) : null}
          </div>

          {conflicts.data && conflicts.data.conflicts.length > 0 ? (
            <ConflictsDock
              key={conflicts.data.conflicts.map((c) => `${c.teacherNameId}:${c.day}:${c.period}`).join("|")}
              conflicts={conflicts.data.conflicts}
            />
          ) : null}

          {!section ? (
            <p className="text-sm text-muted-foreground">Pick a section to load its generic template grid.</p>
          ) : !activeConfig ? (
            <p className="text-sm text-muted-foreground">Loading day configuration…</p>
          ) : (
            <ScheduleTemplateGrid
              rows={rows}
              cells={cellsHook.cells}
              subjects={gradeSubjects.map((s) => ({ id: s.id, name: s.name, code: s.code, category: s.category }))}
              teachers={catalog.teachers}
              subjectTeacherMap={cellsHook.dialogSubjectTeacherMap}
              conflictedCells={conflicts.conflictedCells}
              stagedKeys={stagedKeys}
              isLocked={cellsHook.isLocked}
              saving={cellsHook.saveProgress?.active ?? false}
              onChange={handleTemplateChange}
              onClear={handleTemplateClear}
            />
          )}
          {cellsHook.splitSubjects.length > 0 ? (
            <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
              <p className="font-medium">Blocked: subject split across teachers in {section?.name}.</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                {cellsHook.splitSubjects.map((s) => (
                  <li key={s.subjectId}>
                    {s.subjectName} — {s.teacherNames.join(", ")}. Clear its slots to unify it.
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      {deleteProgress ? (
        <ProgressDock
          title={
            deleteProgress.active
              ? `Deleting ${deleteProgress.rows[0]?.name ?? "subject"}…`
              : deleteProgress.rows.some((r) => r.status === "failed")
                ? "Delete failed"
                : `Deleted ${deleteProgress.rows.length} subject${deleteProgress.rows.length === 1 ? "" : "s"}`
          }
          working={deleteProgress.active}
          steps={deleteProgress.active ? DELETE_STEPS.slice(0, 2) : DELETE_STEPS}
          label={
            deleteProgress.rows[0]
              ? `Deleting ${deleteProgress.rows[0].name} (${deleteProgress.rows[0].code})…`
              : "Deleting subject…"
          }
          doneLabel="Delete complete"
          summary={
            deleteProgress.rows[0]
              ? `${deleteProgress.rows[0].code} · Grade ${deleteProgress.rows[0].gradeLevel.replace("G", "")}`
              : undefined
          }
          onDismiss={() => setDeleteProgress(null)}
        >
          <DeleteDockRows rows={deleteProgress.rows} />
        </ProgressDock>
      ) : null}
      {submitProgress ? (
        <ProgressDock
          title={
            submitProgress.active
              ? `Sending ${submitProgress.total} slot${submitProgress.total === 1 ? "" : "s"}…`
              : submitProgress.rows.some((r) => r.status === "failed")
                ? "Send incomplete"
                : `Sent ${submitProgress.total} slot${submitProgress.total === 1 ? "" : "s"}`
          }
          working={submitProgress.active}
          steps={submitProgress.active ? SUBMIT_STEPS.slice(0, 2) : SUBMIT_STEPS}
          label={
            submitProgress.total > 0
              ? `Sending ${submitProgress.total} slot${submitProgress.total === 1 ? "" : "s"} for review…`
              : "Sending for review…"
          }
          doneLabel="Sent to principal"
          summary={
            submitProgress.rows.length > 0
              ? `${submitProgress.rows.length} section${submitProgress.rows.length === 1 ? "" : "s"} · awaiting principal approval`
              : undefined
          }
          onDismiss={() => setSubmitProgress(null)}
        >
          <SubmitDockRows rows={submitProgress.rows} />
        </ProgressDock>
      ) : null}
      {configProgress ? (
        <ProgressDock
          title={
            configProgress.active
              ? "Saving school day…"
              : configProgress.status === "failed"
                ? "Save failed"
                : "School day saved"
          }
          working={configProgress.active}
          steps={configProgress.active ? CONFIG_SAVE_STEPS.slice(0, 2) : CONFIG_SAVE_STEPS}
          label="Saving school-day shape…"
          doneLabel="School day saved"
          summary={configProgress.summary}
          onDismiss={() => setConfigProgress(null)}
        >
          <ConfigDockRows items={configProgress.items} status={configProgress.status} />
        </ProgressDock>
      ) : null}
      {teacherDeleteProgress ? (
        <ProgressDock
          title={
            teacherDeleteProgress.active
              ? `Deleting ${teacherDeleteProgress.rows.length} teacher${teacherDeleteProgress.rows.length === 1 ? "" : "s"}…`
              : teacherDeleteProgress.rows.some((r) => r.status === "failed")
                ? "Delete incomplete"
                : `Deleted ${teacherDeleteProgress.rows.length} teacher${teacherDeleteProgress.rows.length === 1 ? "" : "s"}`
          }
          working={teacherDeleteProgress.active}
          steps={teacherDeleteProgress.active ? TEACHER_DELETE_STEPS.slice(0, 2) : TEACHER_DELETE_STEPS}
          label={
            teacherDeleteProgress.rows.length > 0
              ? `Deleting ${teacherDeleteProgress.rows.length} teacher${teacherDeleteProgress.rows.length === 1 ? "" : "s"}…`
              : "Deleting teachers…"
          }
          doneLabel="Delete complete"
          summary={
            teacherDeleteProgress.rows.length > 0
              ? `${teacherDeleteProgress.rows.filter((r) => r.status !== "failed").length} deleted · ${teacherDeleteProgress.rows.filter((r) => r.status === "failed").length} failed of ${teacherDeleteProgress.rows.length}`
              : undefined
          }
          onDismiss={() => setTeacherDeleteProgress(null)}
        >
          <TeacherDeleteDockRows rows={teacherDeleteProgress.rows} />
        </ProgressDock>
      ) : null}
      {teacherCreateProgress ? (
        <ProgressDock
          title={
            teacherCreateProgress.active
              ? `Creating ${teacherCreateProgress.rows.length} teacher${teacherCreateProgress.rows.length === 1 ? "" : "s"}…`
              : teacherCreateProgress.rows.some((r) => r.status === "failed")
                ? "Creation incomplete"
                : `Added ${teacherCreateProgress.rows.length} teacher${teacherCreateProgress.rows.length === 1 ? "" : "s"}`
          }
          working={teacherCreateProgress.active}
          steps={teacherCreateProgress.active ? TEACHER_CREATE_STEPS.slice(0, 2) : TEACHER_CREATE_STEPS}
          label={
            teacherCreateProgress.rows.length > 0
              ? `Creating ${teacherCreateProgress.rows.length} teacher${teacherCreateProgress.rows.length === 1 ? "" : "s"}…`
              : "Creating teachers…"
          }
          doneLabel="Creation complete"
          summary={
            teacherCreateProgress.rows.length > 0
              ? `${teacherCreateProgress.rows.filter((r) => r.status !== "failed").length} added · ${teacherCreateProgress.rows.filter((r) => r.status === "failed").length} failed of ${teacherCreateProgress.rows.length}`
              : undefined
          }
          onDismiss={() => setTeacherCreateProgress(null)}
        >
          <TeacherCreateDockRows rows={teacherCreateProgress.rows} />
        </ProgressDock>
      ) : null}
      {createProgress ? (
        <ProgressDock
          title={`Creating ${createProgress.count} subject${createProgress.count === 1 ? "" : "s"}`}
          working
          steps={["Preparing subjects", "Saving to server", "Confirming catalog"].slice(0, 2)}
          label={`Creating ${createProgress.count} subject${createProgress.count === 1 ? "" : "s"} · ${createProgress.gradeLabel} · ${createProgress.categoryLabel}…`}
          doneLabel="Subjects created"
          summary={`${createProgress.gradeLabel} · ${createProgress.categoryLabel}`}
          onDismiss={() => setCreateProgress(null)}
        />
      ) : null}
    </section>
  );
}

export default function TeacherScheduleTemplatePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading template…</p>}>
      <TemplateInner />
    </Suspense>
  );
}
