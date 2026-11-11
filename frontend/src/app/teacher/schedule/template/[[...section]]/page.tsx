"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "@/lib/api/live";

import { AlertTriangle, BookPlus, CalendarDays, Check, Gauge, Pencil, Save, Trash2, Undo2, UserPlus } from "lucide-react";
import { useTerm } from "@/lib/term/TermContext";
import { apiClient } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/useSession";
import { useTeacherOverview } from "@/services/teacher/overview.service";
import { useCachedMasterTeacher } from "@/services/teacher/flagCache";
import { useTeacherInvalidate } from "../../../components/use-teacher-invalidate";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { InsightCallout } from "@/components/ui/insight-callout";
import { Pill } from "@/components/ui/pill";
import { toast } from "@/components/ui/sonner";
import { TemplateNavRail, type TemplateView } from "../../components/TemplateNavRail";
import { SubjectCatalogKanban } from "../../components/subject-catalog-kanban";
import { SubjectAddKanban } from "../../components/subject-add-kanban";
import { TeacherCatalogKanban } from "../../components/teacher-catalog-kanban";
import { TeacherAddKanban } from "../../components/teacher-add-kanban";
import { TemplateFormOverlay } from "../../components/TemplateFormOverlay";
import { TEACHER_CREATE_STEPS, TeacherCreateDockRows } from "../../components/teacher-add-kanban";
import type { TeacherCreateProgress } from "../../components/use-add-teachers";
import { TEACHER_DELETE_STEPS, TeacherDeleteDockRows } from "../../components/teacher-delete-kanban";
import type { TeacherDeleteProgress } from "../../components/teacher-delete-kanban";
import { DropdownSelect } from "@/app/principal/academics/assign/components/DropdownSelect";
import dropdownStyles from "@/app/principal/academics/assign/components/dropdown-select.module.css";
import {
  CONFIG_SAVE_STEPS,
  ConfigDockRows,
  describeConfig,
  ScheduleConfigBoard,
  ScheduleConfigKanban,
  type ConfigSaveProgress,
} from "../../components/schedule-config-kanban";
import { SUBMIT_STEPS, SendToPrincipalKanban, SubmitDockRows, type SubmitProgress } from "../../components/schedule-submit-kanban";
import { buildTimetable, type DayConfig } from "../../components/schedule-time";
import { matchSectionSlug, sectionSlug } from "@/lib/sectionSlug";
import { useScheduleCatalog } from "../../components/use-schedule-catalog";
import { cellKey, useScheduleCells } from "../../components/use-schedule-cells";
import { ScheduleTemplateGrid } from "../../components/ScheduleTemplateGrid";
import { ScheduleUnlockConfirm } from "../../components/schedule-unlock-kanban";
import { Skeleton } from "@/components/ui/skeleton";
import { useScheduleConflicts } from "../../components/use-schedule-conflicts";
import { useTemplateWorkload } from "../../components/use-template-workload";
import { useDockProgressTask, type DockSnapshot } from "../../components/use-dock-progress";
import { ConflictsDock } from "../../components/conflicts-dock";
import type { SubjectCreateProgress } from "../../components/use-add-subjects";
import { DELETE_STEPS, DeleteDockRows, type SubjectDeleteProgress } from "../../components/subject-delete-kanban";
import type { ScheduleSection } from "../../page";

/** One stacked builder block: small caps title sitting at the right end above the divider. */
function TemplateBlockHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="self-end text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </h2>
      <div className="h-px w-full bg-border" aria-hidden />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function sectionLabel(name: string, gradeLevel: string) {
  return (
    <span className={dropdownStyles.optionLabel}>
      <span className={dropdownStyles.optionName}>{name}</span>
      <Pill tone="amber" label="Grade level">
        Grade {gradeLevel.replace("G", "")}
      </Pill>
    </span>
  );
}

/**
 * Skeleton mirrors the current template page: the left rail (back link + find
 * box + action links) next to either the centered section picker/grid or the
 * centered "add the catalog first" callout. No plain text loader.
 */
function ScheduleTemplateSkeleton({ grid }: { grid: boolean }) {
  return (
    <section
      className="flex w-full flex-col gap-5 lg:flex-row lg:items-start lg:gap-6"
      aria-busy="true"
      aria-label="Loading template"
    >
      <div className="hidden w-52 shrink-0 lg:-mt-4 lg:-mb-4 lg:-ml-4 lg:block lg:min-h-[calc(100dvh-3rem)] lg:w-56 lg:border-r lg:border-solid lg:border-border lg:bg-linear-to-b lg:from-muted/40 lg:via-muted/10 lg:to-transparent lg:pt-4 lg:pr-4 lg:pl-4">
        <div className="sticky top-16 flex flex-col gap-2">
          <Skeleton className="h-5 w-28 rounded-md" />
          <Skeleton className="h-8 w-full rounded-md" />
          <div className="flex flex-col gap-0.5 pt-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-7 w-full rounded-md" />
            ))}
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {grid ? (
          <>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-8 w-48 rounded-md" />
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <div className="grid min-w-[52rem] grid-cols-[10rem_repeat(5,minmax(0,1fr))]">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={`h-${i}`} className="m-2 h-5" />
                ))}
                {Array.from({ length: 36 }).map((_, i) => (
                  <Skeleton key={`c-${i}`} className="m-2 h-10" />
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex min-h-[calc(100dvh-10rem)] w-full items-center justify-center">
            <Skeleton className="h-12 w-full max-w-xl rounded-md" />
          </div>
        )}
      </div>
    </section>
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
  const [configProgress, setConfigProgress] = useState<ConfigSaveProgress | null>(null);
  const [submitProgress, setSubmitProgress] = useState<SubmitProgress | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [confirmUnlock, setConfirmUnlock] = useState(false);
  // One panel at a time: the sidebar picks which action's inputs are shown.
  const [view, setView] = useState<TemplateView>(() =>
    viewParam === "config"
      ? "config"
      : viewParam === "send"
        ? "send"
        : viewParam === "add-teacher" || viewParam === "teachers"
          ? "teachers"
          : viewParam === "add-subject" || viewParam === "subjects"
            ? "subjects"
            : viewParam === "grid" || viewParam === "timetable"
              ? "grid"
              : "grid",
  );
  const [kanbanAddOpen, setKanbanAddOpen] = useState(viewParam === "add-subject");
  const [teacherKanbanAddOpen, setTeacherKanbanAddOpen] = useState(viewParam === "add-teacher");
  // The Configure tab shows the applied settings; editing opens the stepper overlay.
  const [configEditorOpen, setConfigEditorOpen] = useState(false);
  // Deep-link sync (?sectionId=… / ?view=…): runs once per param change, not per render.
  /* eslint-disable react-hooks/set-state-in-effect -- deep-link landing sync */
  useEffect(() => {
    if (initialSectionId) {
      setSectionId(initialSectionId);
    }
  }, [initialSectionId]);
  useEffect(() => {
    if (!viewParam) return;
    setView(
      viewParam === "config"
        ? "config"
        : viewParam === "send"
          ? "send"
          : viewParam === "add-teacher" || viewParam === "teachers"
            ? "teachers"
            : viewParam === "add-subject" || viewParam === "subjects"
              ? "subjects"
              : viewParam === "grid" || viewParam === "timetable"
                ? "grid"
                : "grid",
    );
    setKanbanAddOpen(viewParam === "add-subject");
    setTeacherKanbanAddOpen(viewParam === "add-teacher");
  }, [viewParam]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Keep the active panel in the URL so reloading the page lands on the same
  // tab (Timetable / Subjects / Teachers / Configure / Send) instead of resetting.
  useEffect(() => {
    if (viewParam === view) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view);
    router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
  }, [view, viewParam, searchParams, router]);

  const [createProgress, setCreateProgress] = useState<SubjectCreateProgress | null>(null);
  const [deleteProgress, setDeleteProgress] = useState<SubjectDeleteProgress | null>(null);
  const [teacherCreateProgress, setTeacherCreateProgress] = useState<TeacherCreateProgress | null>(null);
  const [teacherDeleteProgress, setTeacherDeleteProgress] = useState<TeacherDeleteProgress | null>(null);

  /** Sidebar click: show that action's panel; any open add form closes first. */
  const openView = (next: TemplateView) => {
    setView(next);
    setKanbanAddOpen(false);
    setTeacherKanbanAddOpen(false);
    // Configure only opens the stepper when there is no saved shape yet; with a
    // record the tab shows the applied settings board (Edit reopens the stepper).
    setConfigEditorOpen(next === "config" && !catalog.activeConfig);
  };

  /** Top-right actions: jump straight into the matching add form. */
  const openAddSubject = () => {
    setView("subjects");
    setTeacherKanbanAddOpen(false);
    setKanbanAddOpen(true);
  };

  const openAddTeacher = () => {
    setView("teachers");
    setKanbanAddOpen(false);
    setTeacherKanbanAddOpen(true);
  };

  const handleKanbanAddOpenChange = (open: boolean) => setKanbanAddOpen(open);

  const handleTeacherKanbanAddOpenChange = (open: boolean) => setTeacherKanbanAddOpen(open);

  const collapseSubjectsView = () => {
    setView("grid");
    setKanbanAddOpen(false);
  };

  const collapseTeachersView = () => {
    setView("grid");
    setTeacherKanbanAddOpen(false);
  };

  const collapseConfigView = () => setConfigEditorOpen(false);

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
  const queryClient = useQueryClient();

  const catalog = useScheduleCatalog(termKey);
  const { workload, setWorkload } = useTemplateWorkload(termKey);
  // The grid block is always on the page, so conflicts only need to load once a
  // section is picked (the grid is the only consumer).
  const needsGrid = Boolean(sectionId);
  const conflicts = useScheduleConflicts(termKey, workload, { enabled: needsGrid });

  const sectionsQuery = useLiveQuery<{ sections: ScheduleSection[] }>({
    queryKey: ["teacher-schedule-section", "template", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ sections: ScheduleSection[] }>("/api/teacher/schedule");
      return data;
    },
    enabled: isMasterTeacher,
    // Realtime invalidation (principal approve/send-back, other master
    // teachers' edits) refreshes this instantly when Supabase push is on.
    // The interval is the safety net so the open grid still syncs when push
    // is unavailable — same shape as the rest of the desk, no manual refresh.
    refetchInterval: 20_000,
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
    router.replace(`/teacher/schedule/template/${encodeURIComponent(slug)}?view=${encodeURIComponent(view)}`, { scroll: false });
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
      const { startTime, periodMins, lunch, morningRecess, afternoonRecess } = next;
      const { data } = await apiClient.patch<{ config: DayConfig }>("/api/teacher/schedule/config", {
        startTime,
        periodMins,
        lunch,
        morningRecess,
        afternoonRecess,
      });
      return data.config;
    },
    onSuccess: () => {
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
    // Low latency: reshape the cached config and close the overlay this tick,
    // then confirm the PATCH in the background. A failed save restores the
    // previous shape so the grid never keeps values the server rejected.
    const { items, summary } = describeConfig(next);
    const previousConfig = queryClient.getQueryData<{ config: DayConfig }>([
      "teacher-schedule-config",
      termKey,
    ]);
    const previousWorkload = workload;
    if (next.workload) setWorkload(next.workload);
    queryClient.setQueryData(["teacher-schedule-config", termKey], { config: next });
    // Stay on the Configure tab: close the stepper and let the board show the
    // applied items while the PATCH confirms in the background.
    setConfigEditorOpen(false);
    setConfigProgress({ active: true, done: false, status: "saving", items, summary });
    configMutation.mutate(next, {
      onError: () => {
        if (previousConfig) {
          queryClient.setQueryData(["teacher-schedule-config", termKey], previousConfig);
        }
        setWorkload(previousWorkload);
      },
    });
  };

  // Everything renders in one panel at a time, so the skeleton only mirrors the
  // grid when we land on the default view (catalog/configure views get the
  // picker-shaped skeleton).
  const masterKnown =
    overview.data?.isMasterTeacher !== undefined ||
    overview.data?.isMasterTeacherSenior !== undefined ||
    cachedMaster;
  const skeletonGrid = view === "grid";
  if (!masterKnown) {
    return <ScheduleTemplateSkeleton grid={skeletonGrid} />;
  }

  if (!isMasterTeacher) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <h1 className="text-2xl font-semibold tracking-tight">Schedule template</h1>
        <p className="text-sm text-muted-foreground">Only Master Teachers can use the schedule template.</p>
      </section>
    );
  }

  if (sectionsQuery.isLoading) {
    return <ScheduleTemplateSkeleton grid={skeletonGrid} />;
  }

  const gradeSubjects = section
    ? catalog.subjects.filter((s) => s.gradeLevel === section.gradeLevel)
    : catalog.subjects;
  const activeConfig = catalog.activeConfig;
  const rows = activeConfig ? buildTimetable({ ...activeConfig, workload }) : [];
  // No catalog → the section picker has nothing to render, so the panel shows
  // the "add the catalog first" note instead.
  const catalogMissing = catalog.subjects.length === 0 || catalog.teachers.length === 0;

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
    <section className="flex w-full flex-col gap-5 lg:flex-row lg:gap-6">
      <TemplateNavRail view={view} onSelect={openView} />
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        {view === "grid" ? (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              className="h-6 gap-1 px-2 text-[11px]"
              onClick={openAddSubject}
            >
              <BookPlus size={12} aria-hidden />
              Add subject
            </Button>
            <Button className="h-6 gap-1 px-2 text-[11px]" onClick={openAddTeacher}>
              <UserPlus size={12} aria-hidden />
              Add teacher
            </Button>
          </div>
        ) : null}
        {view === "subjects" ? (
          <section id="subjects" aria-label="Subjects" className="flex scroll-mt-6 flex-col gap-4">
            <SubjectCatalogKanban
              subjects={catalog.subjects}
              pending={catalog.subjectsQuery.isPending}
              loadError={catalog.subjectsQuery.isError}
              onBack={collapseSubjectsView}
              addOpen={false}
              onAddOpenChange={handleKanbanAddOpenChange}
              onCreateProgress={setCreateProgress}
              onDeleteProgress={setDeleteProgress}
            />
            <TemplateFormOverlay
              open={kanbanAddOpen}
              onClose={() => setKanbanAddOpen(false)}
              label="Add subjects"
            >
              <SubjectAddKanban
                onClose={() => setKanbanAddOpen(false)}
                onProgress={setCreateProgress}
              />
            </TemplateFormOverlay>
          </section>
        ) : view === "teachers" ? (
          <section id="teachers" aria-label="Teachers" className="flex scroll-mt-6 flex-col gap-4">
            <TeacherCatalogKanban
              teachers={catalog.teachers}
              pending={catalog.teachersQuery.isPending}
              loadError={catalog.teachersQuery.isError}
              onBack={collapseTeachersView}
              addOpen={false}
              onAddOpenChange={handleTeacherKanbanAddOpenChange}
              onCreateProgress={setTeacherCreateProgress}
              onDeleteProgress={setTeacherDeleteProgress}
            />
            <TemplateFormOverlay
              open={teacherKanbanAddOpen}
              onClose={() => setTeacherKanbanAddOpen(false)}
              label="Add teachers"
            >
              <TeacherAddKanban
                onClose={() => setTeacherKanbanAddOpen(false)}
                onProgress={setTeacherCreateProgress}
              />
            </TemplateFormOverlay>
          </section>
        ) : view === "config" ? (
          <section
            id="day-configuration"
            aria-label="Day configuration"
            className="flex min-h-[calc(100dvh-12rem)] scroll-mt-6 flex-col justify-center gap-4"
          >
            {activeConfig ? (
              <ScheduleConfigBoard
                config={{ ...activeConfig, workload }}
                onEdit={() => setConfigEditorOpen(true)}
                saving={configMutation.isPending}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Loading day configuration…</p>
            )}
          </section>
        ) : view === "send" ? (
          <section id="send-to-principal" aria-label="Send to principal" className="flex scroll-mt-6 flex-col gap-4">
            <TemplateBlockHeading
              title="Send to principal"
              hint="Review the drafts and submit them for approval."
            />
            <SendToPrincipalKanban onSubmitProgress={setSubmitProgress} />
          </section>
        ) : (
          <>
            {/* Default view — section picker on top of the cell filler. */}
            <section
              id="teachers-subjects"
              aria-label="Teachers and subjects"
              className={`flex scroll-mt-6 flex-col gap-4 ${
                section || catalogMissing ? "" : "min-h-[calc(100dvh-12rem)] justify-center"
              }`}
            >
              {catalogMissing ? (
                <div className="flex min-h-80 items-center justify-center">
                  <InsightCallout role="status" className="w-fit max-w-xl text-center">
                    Add at least one <strong>subject</strong> (with Core/Elective type) and one{" "}
                    <strong>teacher</strong> first — then pick a section to fill its timetable cells.
                  </InsightCallout>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex flex-wrap items-center justify-center gap-2">
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
                            ariaLabel="Section for this template"
                            triggerClassName={dropdownStyles.dropdown32}
                          />
                        </span>
                      </span>
                    </div>
                    {conflicts.data ? (
                      <span className="flex flex-wrap items-center justify-center gap-1.5" role="status">
                        <Pill tone="amber" label="Double-book warnings">
                          <AlertTriangle size={12} aria-hidden className="text-amber-500" />
                          {conflicts.data.conflicts.length} double-book warning
                          {conflicts.data.conflicts.length === 1 ? "" : "s"}
                        </Pill>
                        <Pill tone="amber" label="Workload warnings">
                          <Gauge size={12} aria-hidden className="text-amber-500" />
                          {conflicts.data.workload.overDaily.length + conflicts.data.workload.overWeekly.length}{" "}
                          overload warning
                          {conflicts.data.workload.overDaily.length + conflicts.data.workload.overWeekly.length === 1
                            ? ""
                            : "s"}
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
                    <p className="text-center text-sm text-muted-foreground">
                      Pick a section to load its generic template grid.
                    </p>
                  ) : !activeConfig ? (
                    <p className="text-sm text-muted-foreground">Loading day configuration…</p>
                  ) : (
                    <>
                      {cellsHook.pendingSlots.length > 0 || cellsHook.saveProgress?.active ? (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <span className="text-xs text-muted-foreground" aria-live="polite">
                            {cellsHook.saveProgress?.active
                              ? "Saving staged slots…"
                              : `${cellsHook.pendingSlots.length} unsaved slot${cellsHook.pendingSlots.length === 1 ? "" : "s"}`}
                          </span>
                          {cellsHook.saveProgress?.active ? (
                            <Button size="sm" disabled aria-busy className="h-6 gap-1 px-2 text-[11px]">
                              <Save size={12} aria-hidden />
                              Saving…
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => void cellsHook.saveAll()}
                              className="h-6 gap-1 px-2 text-[11px]"
                            >
                              <Save size={12} aria-hidden />
                              Save{cellsHook.pendingSlots.length > 0 ? ` (${cellsHook.pendingSlots.length})` : ""}
                            </Button>
                          )}
                          {!cellsHook.saveProgress?.active ? (
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
                              className="h-6 gap-1 px-2 text-[11px]"
                            >
                              <Trash2 size={12} aria-hidden />
                              {confirmClearAll ? "Confirm?" : "Clear all"}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                      <KanbanBoard
                        title={
                          section ? `Timetable — ${section.name}` : "Timetable"
                        }
                        icon={
                          <span className="text-amber-500" aria-hidden>
                            <CalendarDays size={14} />
                          </span>
                        }
                        count={`${cellsHook.filledCount} slot${cellsHook.filledCount === 1 ? "" : "s"}`}
                        actions={
                          cellsHook.isLocked ? (
                            <span className="flex items-center gap-1.5">
                              <Pill tone="green" label="Schedule status">
                                <Check size={12} aria-hidden className="text-green-500" />
                                Approved
                              </Pill>
                              <Button
                                variant="outline"
                                className="h-6 gap-1 px-2 text-[11px]"
                                onClick={() => setConfirmUnlock(true)}
                                disabled={cellsHook.unlock.isPending}
                                aria-busy={cellsHook.unlock.isPending || undefined}
                              >
                                <Pencil size={12} aria-hidden />
                                Edit
                              </Button>
                            </span>
                          ) : cellsHook.editMode && cellsHook.serverLocked ? (
                            <span className="flex items-center gap-1.5">
                              <Pill tone="amber" label="Schedule status">
                                <Pencil size={12} aria-hidden />
                                Editing — still approved
                              </Pill>
                              <Button
                                variant="outline"
                                className="h-6 gap-1 px-2 text-[11px]"
                                onClick={cellsHook.cancelEdit}
                              >
                                <Undo2 size={12} aria-hidden />
                                Cancel edit
                              </Button>
                            </span>
                          ) : null
                        }
                        ariaLabel="Timetable slots"
                        boardLabel={
                          section
                            ? `${section.name} timetable, ${cellsHook.filledCount} slots, ${
                                cellsHook.isLocked ? "approved" : cellsHook.editMode ? "editing" : "in progress"
                              }`
                            : "Timetable"
                        }
                        footer={
                          cellsHook.isLocked ? (
                            <p className="px-1 text-xs text-muted-foreground">
                              Approved timetable — the official record for this term. It is read-only
                              until you press Edit.
                            </p>
                          ) : cellsHook.editMode && cellsHook.serverLocked ? (
                            <p className="px-1 text-xs text-muted-foreground">
                              Editing a working draft. The approved slots stay official until you
                              press Save — Cancel edit leaves the approval untouched.
                            </p>
                          ) : null
                        }
                      >
                        <ScheduleTemplateGrid
                          rows={rows}
                          cells={cellsHook.cells}
                          subjects={gradeSubjects.map((s) => ({
                            id: s.id,
                            name: s.name,
                            code: s.code,
                            category: s.category,
                          }))}
                          teachers={catalog.teachers}
                          subjectTeacherMap={cellsHook.dialogSubjectTeacherMap}
                          conflictedCells={conflicts.conflictedCells}
                          stagedKeys={stagedKeys}
                          isLocked={cellsHook.isLocked}
                          saving={cellsHook.saveProgress?.active ?? false}
                          onChange={handleTemplateChange}
                          onClear={handleTemplateClear}
                        />
                      </KanbanBoard>
                    </>
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
              )}
            </section>
          </>
        )}

        {view === "config" && configEditorOpen ? (
          <TemplateFormOverlay open onClose={collapseConfigView} label="Configure school day">
            {activeConfig ? (
              <ScheduleConfigKanban
                config={{ ...activeConfig, workload }}
                onClose={collapseConfigView}
                onApply={handleConfigApply}
                saving={configMutation.isPending}
              />
            ) : (
              <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-xl">
                Loading day configuration…
              </div>
            )}
          </TemplateFormOverlay>
        ) : null}

        {confirmUnlock && section ? (
          <ScheduleUnlockConfirm
            section={section}
            onCancel={() => setConfirmUnlock(false)}
            onConfirm={() => {
              // Local-only: entering the edit session does not touch the
              // approval. The unlock happens when a change is actually saved.
              cellsHook.beginEdit();
              setConfirmUnlock(false);
            }}
          />
        ) : null}
      </div>
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
