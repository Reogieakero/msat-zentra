"use client";

import { useLiveQuery } from "@/lib/api/live";
import { useTerm } from "@/lib/term/TermContext";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { useCachedMasterTeacher } from "@/services/teacher/flagCache";
import { useTeacherOverview } from "@/services/teacher/overview.service";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InsightCallout } from "@/components/ui/insight-callout";
import { SectionScheduleTable } from "@/components/schedule/section-schedule-table";
import type { StatusEntry } from "@/components/schedule/SectionScheduleCard";
import { sectionSlug } from "@/lib/sectionSlug";

import { ScheduleGutter } from "./components/schedule-gutter";
import { TeacherPageHeader } from "../components/TeacherPageHeader";
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

function ScheduleSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading schedule">
      <ZentraPageHeaderSkeleton />
      <div className="mx-auto w-full max-w-[60rem] rounded-xl border border-border bg-card p-2.5">
        <div className="flex items-center gap-2 border-b border-border px-1 pb-2">
          <Skeleton className="h-3.5 w-32" />
          <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-5 w-16 rounded-full" />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 px-1 pt-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
              <Skeleton className="h-3 w-40 max-w-[40%]" />
              <Skeleton className="ml-auto h-5 w-20 rounded-full" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
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
  } = useLiveQuery<ScheduleData>({
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

  // Empty desk: center the callout in the middle of the viewport area
  // (both axes) and skip the page header entirely.
  if (orderedSections.length === 0) {
    return (
      <section className="relative flex min-h-full w-full items-center justify-center py-10">
        <div className="absolute right-0 top-0 flex items-center gap-2">
          <ScheduleGutter />
          <Button asChild size="sm" className="h-6 px-2 text-xs">
            <a href="/teacher/schedule/template" target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} aria-hidden />
              Open schedule template
            </a>
          </Button>
        </div>
        <InsightCallout role="status" className="w-full max-w-md text-left">
          <strong>No sections yet.</strong> Sections created by the principal
          for your Master Teacher bands will appear here for scheduling.
        </InsightCallout>
      </section>
    );
  }

  return (
    <section className="flex w-full flex-col">
      <div className="flex min-w-0 flex-col gap-5">
        <TeacherPageHeader
          title="Schedule"
          description="Master scheduling workspace for the grade bands you hold, their sections, subjects, and timetable slots."
          actions={
            <div className="flex items-center gap-2">
              <ScheduleGutter />
              <Button asChild size="sm" className="h-6 px-2 text-xs">
                <a href="/teacher/schedule/template" target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={14} aria-hidden />
                  Open schedule template
                </a>
              </Button>
            </div>
          }
        />
        <SectionScheduleTable
          sections={orderedSections}
          grades={grades.map((g) => gradeNumber(g.key))}
          hrefFor={(section) =>
            `/teacher/schedule/template/${encodeURIComponent(
              sectionSlug(section.name, section.gradeLevel, orderedSections),
            )}`
          }
          linkTarget="_blank"
          actionLabel="Open"
          title="Sections"
          description="Timetables for the sections in the grade bands you hold. Open a section to build or update its schedule."
          emptyHint="No sections yet"
        />
      </div>
    </section>
  );
}
