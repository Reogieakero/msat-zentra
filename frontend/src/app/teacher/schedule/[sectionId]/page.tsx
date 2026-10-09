"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { useTerm } from "@/lib/term/TermContext";
import { useCachedMasterTeacher } from "@/services/teacher/flagCache";
import { useTeacherOverview } from "@/services/teacher/overview.service";
import { ScheduleWeekSetup } from "../components/ScheduleWeekSetup";
import { ZentraPageHeaderSkeleton, ZentraTableSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import type { ScheduleSection } from "../page";

function LoadingShell() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5" aria-busy="true" aria-label="Loading schedule">
      <ZentraPageHeaderSkeleton />
      <ZentraTableSkeleton rows={8} columns={5} />
    </section>
  );
}

export default function TeacherSectionSchedulePage() {
  const params = useParams<{ sectionId: string }>();
  const sectionId = params.sectionId;
  const session = useSession();
  const overview = useTeacherOverview();
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const cachedMaster = useCachedMasterTeacher(session?.sub);
  const isMasterTeacher = overview.data?.isMasterTeacher ?? cachedMaster;

  const {
    data: schedData,
    isLoading: schedIsLoading,
    isError: schedIsError,
  } = useQuery<{ sections: ScheduleSection[] }>({
    queryKey: ["teacher-schedule-section", sectionId, termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ sections: ScheduleSection[] }>(
        `/api/teacher/schedule?sectionId=${encodeURIComponent(sectionId)}`,
      );
      return data;
    },
    enabled: isMasterTeacher,
  });

  if (overview.isPending) {
    return <LoadingShell />;
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
          Enable Master Teacher status in Settings to manage subject assignments for grades 7–10.
        </div>
      </section>
    );
  }

  if (schedIsLoading) {
    return <LoadingShell />;
  }

  if (schedIsError || !schedData) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <p role="alert" className="text-sm text-destructive">Could not load schedule.</p>
      </section>
    );
  }

  const section = schedData.sections.find((s) => s.id === sectionId) ?? null;
  if (!section) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Section not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This section does not exist or is outside grades 7–10.
          </p>
        </div>
        <div>
          <Link
            href="/teacher/schedule"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Back to sections
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="flex w-full flex-col gap-5">
      <ScheduleWeekSetup section={section} />
    </section>
  );
}
