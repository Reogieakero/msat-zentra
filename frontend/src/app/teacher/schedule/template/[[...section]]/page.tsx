"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, Gauge } from "lucide-react";
import { useTerm } from "@/lib/term/TermContext";
import { apiClient } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/useSession";
import { useTeacherOverview } from "@/services/teacher/overview.service";
import { useCachedMasterTeacher } from "@/services/teacher/flagCache";
import { useTeacherInvalidate } from "../../../components/use-teacher-invalidate";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { toast } from "@/components/ui/sonner";
import { TeacherPageHeader } from "../../../components/TeacherPageHeader";
import { TemplateCatalogBoards } from "../../components/TemplateCatalogBoards";
import { SubjectCatalogKanban } from "../../components/subject-catalog-kanban";
import { TeacherCatalogKanban } from "../../components/teacher-catalog-kanban";
import { TEACHER_CREATE_STEPS, TeacherCreateDockRows } from "../../components/teacher-add-kanban";
import type { TeacherCreateProgress } from "../../components/use-add-teachers";
import { TEACHER_DELETE_STEPS, TeacherDeleteDockRows } from "../../components/teacher-delete-kanban";
import type { TeacherDeleteProgress } from "../../components/teacher-delete-kanban";
import { TemplateConfigBoards } from "../../components/TemplateConfigBoards";
import { DropdownSelect } from "@/app/principal/academics/assign/components/DropdownSelect";
import dropdownStyles from "@/app/principal/academics/assign/components/dropdown-select.module.css";
import stepperStyles from "../../components/template-stepper.module.css";
import {
  CONFIG_SAVE_STEPS,
  ConfigDockRows,
  describeConfig,
  ScheduleConfigKanban,
  type ConfigSaveProgress,
} from "../../components/schedule-config-kanban";
import { SUBMIT_STEPS, SendToPrincipalKanban, SubmitDockRows, type SubmitProgress } from "../../components/schedule-submit-kanban";
import { buildTimetable, workloadOf, type DayConfig } from "../../components/schedule-time";
import { matchSectionSlug, sectionSlug } from "@/lib/sectionSlug";
import { useScheduleCatalog } from "../../components/use-schedule-catalog";
import { cellKey, useScheduleCells } from "../../components/use-schedule-cells";
import { ScheduleTemplateGrid } from "../../components/ScheduleTemplateGrid";
import { useScheduleConflicts } from "../../components/use-schedule-conflicts";
import { useTemplateWorkload } from "../../components/use-template-workload";
import { useDockProgressTask, type DockSnapshot } from "../../components/use-dock-progress";
import { ConflictsDock } from "../../components/conflicts-dock";
import type { SubjectCreateProgress } from "../../components/use-add-subjects";
import { DELETE_STEPS, DeleteDockRows, type SubjectDeleteProgress } from "../../components/subject-delete-kanban";
import kanbanStyles from "../../components/subject-kanban.module.css";
import type { ScheduleSection } from "../../page";

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

/**
 * Collapses a page-local progress state into the one shape the shared Dock
 * understands, so every confirmed action reports it the same way.
 */
function dockSnapshotOf(input: {
  active: boolean;
  total: number;
  settled: number;
  failed: number;
  activeTitle: string;
  activeDescription: string;
  doneTitle: string;
  failedTitle: string;
  doneDescription: string;
}): DockSnapshot {
  const total = input.total > 0 ? input.total : undefined;
  if (input.active) {
    return {
      active: true,
      title: input.activeTitle,
      description: input.activeDescription,
      total,
    };
  }
  const failed = input.failed > 0;
  return {
    active: false,
    failed,
    title: failed ? input.failedTitle : input.doneTitle,
    description: failed
      ? `${input.failed} of ${input.total} failed — please try again.`
      : input.doneDescription,
    total,
  };
}

function TemplateInner() {
  const searchParams = useSearchParams();
  const params = useParams<{ section?: string | string[] }>();
  const router = useRouter();
  // Pretty route: /teacher/schedule/template/<section-name-slug>. The legacy
  // ?sectionId= deep link (notifications) still works.
  const routeSegment = Array.isArray(params?.section) ? (params.section[0] ?? "") : (params?.section ?? "");
  const slugSegment = routeSegment ? decodeURIComponent(String(routeSegment)) : "";
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
    viewParam === "send" ? 3 : viewParam === "config" ? 1 : initialSectionId || slugSegment ? 2 : 0,
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
  const isMasterTeacher =
    overview.data?.isMasterTeacher ||
    overview.data?.isMasterTeacherSenior ||
    cachedMaster;
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

  // Resolve /template/<section-slug> once the section list lands.
  const [slugResolved, setSlugResolved] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect -- one-shot slug → id resolution */
  useEffect(() => {
    if (slugResolved || !slugSegment || sections.length === 0) return;
    const hit = matchSectionSlug(slugSegment, sections);
    if (hit) {
      setSectionId(hit.id);
      if (!viewParam) setStep(2);
    }
    setSlugResolved(true);
  }, [slugSegment, sections, slugResolved, viewParam]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Picking a section keeps the URL shareable: /template/<slug> (+ ?view=…).
  const handleSectionChange = (id: string) => {
    setSectionId(id);
    const picked = sections.find((s) => s.id === id);
    if (!picked) return;
    const slug = sectionSlug(picked.name, picked.gradeLevel, sections);
    const qs = viewParam ? `?view=${encodeURIComponent(viewParam)}` : "";
    router.replace(`/teacher/schedule/template/${encodeURIComponent(slug)}${qs}`, { scroll: false });
  };

  const cellsHook = useScheduleCells(
    section ?? { id: "__template__", name: "", gradeLevel: "G7", timetableEntries: [] } as unknown as ScheduleSection,
    { subjectById: catalog.subjectById, teacherById: catalog.teacherById },
    { silent: true, persistKey: `zentra.schedule-template-cells:${termKey}:${sectionId}` },
  );
  const stagedKeys = useMemo(
    () => new Set(cellsHook.pendingSlots.map((p) => p.key)),
    [cellsHook.pendingSlots],
  );

  // Every confirmed action on this page reports to the one shared Dock
  // (`components/dock`), never its own floating panel.
  const subjectDeleteDock = useMemo<DockSnapshot | null>(() => {
    if (!deleteProgress) return null;
    const rows = deleteProgress.rows;
    const total = rows.length;
    const settled = rows.filter((r) => r.status !== "deleting").length;
    const failed = rows.filter((r) => r.status === "failed").length;
    return dockSnapshotOf({
      active: deleteProgress.active,
      total,
      settled,
      failed,
      activeTitle: `Deleting ${rows[0]?.name ?? "subject"}…`,
      activeDescription: `${settled}/${total} settled — ${rows[0]?.code ?? "catalog"}`,
      doneTitle: `Deleted ${total} subject${total === 1 ? "" : "s"}`,
      failedTitle: "Delete incomplete",
      doneDescription: `${total} removed from the catalog`,
    });
  }, [deleteProgress]);

  const submitDock = useMemo<DockSnapshot | null>(() => {
    if (!submitProgress) return null;
    const rows = submitProgress.rows;
    const total = submitProgress.total;
    const settled = rows.filter((r) => r.status !== "submitting").length;
    const failed = rows.filter((r) => r.status === "failed").length;
    return dockSnapshotOf({
      active: submitProgress.active,
      total,
      settled,
      failed,
      activeTitle: `Sending ${total} slot${total === 1 ? "" : "s"} for review…`,
      activeDescription: `${settled}/${total} slot${total === 1 ? "" : "s"} sent`,
      doneTitle: `Sent ${total} slot${total === 1 ? "" : "s"}`,
      failedTitle: "Send incomplete",
      doneDescription: `${rows.length} section${rows.length === 1 ? "" : "s"} · awaiting principal approval`,
    });
  }, [submitProgress]);

  const configDock = useMemo<DockSnapshot | null>(() => {
    if (!configProgress) return null;
    if (configProgress.active) {
      return { active: true, title: "Saving school day…", description: configProgress.summary };
    }
    return configProgress.status === "failed"
      ? {
          active: false,
          failed: true,
          title: "Save failed",
          description: configProgress.message ?? "The school day was not saved.",
        }
      : { active: false, title: "School day saved", description: configProgress.summary };
  }, [configProgress]);

  const teacherCreateDock = useMemo<DockSnapshot | null>(() => {
    if (!teacherCreateProgress) return null;
    const rows = teacherCreateProgress.rows;
    const total = rows.length;
    const settled = rows.filter((r) => r.status !== "creating").length;
    const failed = rows.filter((r) => r.status === "failed").length;
    return dockSnapshotOf({
      active: teacherCreateProgress.active,
      total,
      settled,
      failed,
      activeTitle:
        total > 0 ? `Creating ${total} teacher${total === 1 ? "" : "s"}…` : "Creating teacher names…",
      activeDescription: total > 0 ? `${settled}/${total} saved` : "Saving to server",
      doneTitle: `Added ${total} teacher${total === 1 ? "" : "s"}`,
      failedTitle: "Creation incomplete",
      doneDescription: `${total} name${total === 1 ? "" : "s"} now pickable in timetable slots`,
    });
  }, [teacherCreateProgress]);

  const teacherDeleteDock = useMemo<DockSnapshot | null>(() => {
    if (!teacherDeleteProgress) return null;
    const rows = teacherDeleteProgress.rows;
    const total = rows.length;
    const settled = rows.filter((r) => r.status !== "deleting").length;
    const failed = rows.filter((r) => r.status === "failed").length;
    return dockSnapshotOf({
      active: teacherDeleteProgress.active,
      total,
      settled,
      failed,
      activeTitle: `${total} teacher${total === 1 ? "" : "s"} · deleting…`,
      activeDescription: `${settled}/${total} removed`,
      doneTitle: `Deleted ${total} teacher${total === 1 ? "" : "s"}`,
      failedTitle: "Delete incomplete",
      doneDescription: `${total} removed from the catalog`,
    });
  }, [teacherDeleteProgress]);

  // Subject creation reports no settle flag (its progress clears on finish),
  // so the Dock settles it when the state goes away.
  const subjectCreateDock = useMemo<DockSnapshot | null>(() => {
    if (!createProgress) return null;
    const n = createProgress.count;
    return {
      active: true,
      title: `Creating ${n} subject${n === 1 ? "" : "s"}…`,
      description: `${createProgress.gradeLabel} · ${createProgress.categoryLabel}`,
      total: n,
    };
  }, [createProgress]);

  useDockProgressTask(subjectDeleteDock);
  useDockProgressTask(submitDock);
  useDockProgressTask(configDock);
  useDockProgressTask(teacherCreateDock);
  useDockProgressTask(teacherDeleteDock);
  useDockProgressTask(subjectCreateDock);

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
  const masterKnown =
    overview.data?.isMasterTeacher !== undefined ||
    overview.data?.isMasterTeacherSenior !== undefined ||
    cachedMaster;
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
                onValueChange={handleSectionChange}
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
                onValueChange={handleSectionChange}
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
                  onValueChange={handleSectionChange}
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
                <Pill tone="amber" label="Double-book warnings">
                  <AlertTriangle size={12} aria-hidden className="text-amber-500" />
                  {conflicts.data.conflicts.length} double-book warning{conflicts.data.conflicts.length === 1 ? "" : "s"}
                </Pill>
                <Pill tone="amber" label="Workload warnings">
                  <Gauge size={12} aria-hidden className="text-amber-500" />
                  {conflicts.data.workload.overDaily.length + conflicts.data.workload.overWeekly.length} overload warning
                  {conflicts.data.workload.overDaily.length + conflicts.data.workload.overWeekly.length === 1 ? "" : "s"}
                </Pill>
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
