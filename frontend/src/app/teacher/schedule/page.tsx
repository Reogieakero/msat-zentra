"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTerm } from "@/lib/term/TermContext";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { useCachedMasterTeacher } from "@/services/teacher/flagCache";
import { useTeacherOverview } from "@/services/teacher/overview.service";
import { ExternalLink, Inbox, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { ScrollList } from "@/components/ui/scroll-list";
import { Pill, type PillTone } from "@/components/ui/pill";
import { sectionSlug } from "@/lib/sectionSlug";

import {
  SECTION_CARD_STATUS_META,
  sectionCardStatus,
} from "@/components/schedule/SectionScheduleCard";
import type { StatusEntry } from "@/components/schedule/SectionScheduleCard";
import styles from "./schedule-empty.module.css";
import kanbanStyles from "./components/subject-kanban.module.css";
import { ScheduleGutter } from "./components/schedule-gutter";
import { TeacherPageHeader } from "../components/TeacherPageHeader";
import { TeacherEmptyCard } from "../components/TeacherEmptyCard";
import { ZentraPageHeaderSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { Skeleton } from "@/components/ui/skeleton";

export interface ScheduleSubject {
  id: string;
  name: string;
  code: string;
  gradeLevel: string;
  category: string;
}

interface Assignment {
  id: string;
  subjectId: string;
  sectionId: string;
  subject: ScheduleSubject;
  section: { name: string; gradeLevel: string };
}

export interface ScheduleSection {
  id: string;
  name: string;
  gradeLevel: string;
  adviserId: string | null;
  adviser: { fullName: string } | null;
  _count: { students: number };
  teacherAssignments: Assignment[];
  timetableEntries: TimetableEntry[];
}

export type ScheduleSectionSummary = Omit<ScheduleSection, "timetableEntries"> & {
  timetableEntries: StatusEntry[];
};

export interface TimetableEntry {
  subjectId: string;
  teacherNameId: string | null;
  day: number;
  period: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  reviewNote: string | null;
  subject: { id: string; name: string; code: string };
  teacherName: { id: string; name: string } | null;
}

interface ScheduleData {
  sections: ScheduleSectionSummary[];
}

const ALL_GRADES = [
  { key: "G7", label: "Grade 7", band: "7-10" },
  { key: "G8", label: "Grade 8", band: "7-10" },
  { key: "G9", label: "Grade 9", band: "7-10" },
  { key: "G10", label: "Grade 10", band: "7-10" },
  { key: "G11", label: "Grade 11", band: "11-12" },
  { key: "G12", label: "Grade 12", band: "11-12" },
] as const;

/* Section-card status → shared pill tone (Bootstrap-ish status families). */
const SECTION_STATUS_TONE: Record<string, PillTone> = {
  submitted: "blue",
  returned: "amber",
  approved: "green",
  draft: "red",
  empty: "neutral",
};

function ScheduleSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading schedule">
      <ZentraPageHeaderSkeleton />
      <div className={styles.skelGrid}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.skelCard}>
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="space-y-1.5 mt-2">
              {[0, 1].map((j) => (
                <Skeleton key={j} className="h-8 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TeacherSchedulePage() {
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const session = useSession();
  const overview = useTeacherOverview();

  const cachedMaster = useCachedMasterTeacher(session?.sub);
  const isMasterTeacher =
    overview.data?.isMasterTeacher ||
    overview.data?.isMasterTeacherSenior ||
    cachedMaster;
  const heldBands = {
    junior: overview.data ? overview.data.isMasterTeacher : cachedMaster,
    senior: overview.data?.isMasterTeacherSenior ?? false,
  };

  const {
    data: schedData,
    isLoading: schedIsLoading,
    isError: schedIsError,
  } = useQuery<ScheduleData>({
    queryKey: ["teacher-schedule-summary", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<ScheduleData>("/api/teacher/schedule?summary=1");
      return data;
    },
    enabled: isMasterTeacher,
  });

  if (overview.isPending) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <ScheduleSkeleton />
      </section>
    );
  }

  if (!isMasterTeacher) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Only Master Teachers can access the subject scheduling workspace.
          </p>
        </div>
        <div className="rounded-xl border border-input bg-card p-8 text-center text-sm text-muted-foreground">
          Enable Master Teacher status in Settings to manage subject assignments for grades 7–12.
        </div>
      </section>
    );
  }

  if (schedIsLoading) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <ScheduleSkeleton />
      </section>
    );
  }

  if (schedIsError || !schedData) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <p role="alert" className="text-sm text-destructive">Could not load schedule.</p>
      </section>
    );
  }

  const sections = schedData.sections;
  const grades = ALL_GRADES.filter((g) =>
    g.band === "11-12" ? heldBands.senior : heldBands.junior,
  );

  const gradeNumber = (g: string) => Number(g.replace("G", "")) || 0;
  const orderedSections = [...sections].sort(
    (a, b) => gradeNumber(a.gradeLevel) - gradeNumber(b.gradeLevel) || a.name.localeCompare(b.name),
  );
  const byGrade = new Map<string, typeof orderedSections>();
  for (const g of grades) byGrade.set(g.key, []);
  for (const s of orderedSections) {
    const bucket = byGrade.get(s.gradeLevel);
    if (bucket) bucket.push(s);
    else byGrade.set(s.gradeLevel, [s]);
  }

  return (
    <section className="flex w-full flex-col">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_2.75rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <TeacherPageHeader
            title="Schedule"
            description="Master scheduling workspace for the grade bands you hold, their sections, subjects, and timetable slots."
            actions={
              <Button asChild size="sm" className="h-8 px-3">
                <a href="/teacher/schedule/template" target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={14} aria-hidden />
                  Open schedule template
                </a>
              </Button>
            }
          />
          {orderedSections.length === 0 ? (
            <TeacherEmptyCard
              centered
              icon={Inbox}
              title="No sections yet"
              hint="Sections created by the principal for your Master Teacher bands will appear here for scheduling."
              label="Schedule sections"
            />
          ) : (
            <div className={kanbanStyles.view} aria-label="Sections by grade level">
              <div className={kanbanStyles.grid} role="group" aria-label="Sections">
                {grades.map((g, colIdx) => {
                  const list = byGrade.get(g.key) ?? [];
                  return (
                    <div
                      key={g.key}
                      role="listitem"
                      aria-label={`${g.label} sections`}
                      className={kanbanStyles.column}
                      style={{ animationDelay: `${colIdx * 70}ms` }}
                    >
                      <KanbanBoard
                        title={g.label}
                        icon={
                          <span className="text-amber-500" aria-hidden>
                            <LayoutGrid size={14} />
                          </span>
                        }
                        count={<span className="text-amber-600 dark:text-amber-500">{list.length}</span>}
                        className="h-full"
                      >
                        {list.length === 0 ? (
                          <p className={kanbanStyles.empty}>No {g.label} sections.</p>
                        ) : (
                          <ScrollList className="max-h-[46dvh] gap-[0.375rem] pr-[2px]" ariaLabel={`${g.label} sections list`}>
                            {list.map((section, cardIdx) => {
                              const status = sectionCardStatus(section.timetableEntries);
                              const meta = SECTION_CARD_STATUS_META[status];
                              const scheduled = section.timetableEntries.length > 0;
                              return (
                                <Link
                                  key={section.id}
                                  href={`/teacher/schedule/template/${encodeURIComponent(sectionSlug(section.name, section.gradeLevel, orderedSections))}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={
                                    scheduled
                                      ? `Open schedule for ${section.name} in template (new tab)`
                                      : `Set up schedule for ${section.name} in template (new tab) — no schedule yet`
                                  }
                                  className={kanbanStyles.card}
                                  style={{ animationDelay: `${colIdx * 70 + Math.min(cardIdx, 8) * 35}ms` }}
                                >
                                  <span className="flex min-w-0 flex-1 items-center gap-2">
                                    <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                                      <span className="w-full truncate text-[13px] font-medium" title={section.name}>
                                        {section.name}
                                      </span>
                                      <span className="flex flex-wrap items-center gap-1">
                                        <Pill tone={SECTION_STATUS_TONE[status] ?? "neutral"} label="Schedule status">
                                          <span
                                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                                            style={{ backgroundColor: meta.color }}
                                            aria-hidden="true"
                                          />
                                          {meta.label}
                                        </Pill>
                                        <Pill tone="amber" label="Timetable slots">
                                          {section.timetableEntries.length} slot{section.timetableEntries.length === 1 ? "" : "s"}
                                        </Pill>
                                      </span>
                                      <span className="w-full truncate text-[11px] text-muted-foreground" title={section.adviser?.fullName ?? "No adviser"}>
                                        {section.adviser?.fullName ?? "No adviser"}
                                        {scheduled ? null : " · No schedule yet — tap to set up"}
                                      </span>
                                    </span>
                                  </span>
                                </Link>
                              );
                            })}
                          </ScrollList>
                        )}
                      </KanbanBoard>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <aside className="self-start lg:sticky lg:top-16" aria-label="Schedule tools">
          <ScheduleGutter />
        </aside>
      </div>
    </section>
  );
}
