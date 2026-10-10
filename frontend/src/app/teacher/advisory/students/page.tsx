"use client";

import * as React from "react";
import Link from "next/link";
import { AdvisoryGradesTable } from "./components/AdvisoryGradesTable";
import { TeacherPageHeader } from "../../components/TeacherPageHeader";
import { TeacherEmptyCard } from "../../components/TeacherEmptyCard";
import { ZentraPageHeaderSkeleton, ZentraFilterBarSkeleton, ZentraTableSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { Button } from "@/components/ui/button";
import { Loader2, Users } from "lucide-react";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { useAdvisoryRoster } from "@/services/teacher/advisory.service";

export default function TeacherAdvisoryStudentsPage() {
  const rosterQuery = useAdvisoryRoster();
  const students = React.useMemo(
    () => rosterQuery.data?.students ?? [],
    [rosterQuery.data],
  );
  const sections = React.useMemo(
    () => rosterQuery.data?.advisorySections ?? [],
    [rosterQuery.data],
  );
  const offeredSubjects = React.useMemo(
    () => rosterQuery.data?.subjects ?? [],
    [rosterQuery.data],
  );

  return (
    <section className="flex w-full min-w-0 flex-1 flex-col gap-4">
      {rosterQuery.isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading students">
          <ZentraPageHeaderSkeleton />
          <ZentraFilterBarSkeleton selects={2} />
          <ZentraTableSkeleton rows={8} columns={5} />
        </div>
      ) : rosterQuery.isError ? (
        <TeacherEmptyCard
          centered
          icon={Users}
          title="No advisory section assigned"
          hint="No advisory section assigned, or it could not be loaded. Contact the school office."
          label="Advisory students"
          action={
            <Button variant="outline" size="sm" onClick={() => rosterQuery.refetch()} disabled={rosterQuery.isFetching}>
              {rosterQuery.isFetching ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  <span aria-live="polite">Retrying</span>
                </>
              ) : (
                "Try again"
              )}
            </Button>
          }
        />
      ) : students.length === 0 ? (
        <div className="flex min-h-[calc(100dvh-8rem)] w-full items-center justify-center">
          <div className={`${assign.card} w-full max-w-md`}>
            <span className={assign.glowClip} aria-hidden="true">
              <span className={assign.cardGlow} />
            </span>
            <div className="relative flex flex-col items-center gap-2 py-6 text-center">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
                aria-hidden="true"
              >
                <Users size={24} className="text-muted-foreground" />
              </span>
              <p className="font-medium">No advisory students yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Students enlisted in your advisory section will appear here with their live grades.
              </p>
              <Button asChild size="sm" className="mt-2">
                <Link href="/teacher/advisory/list">Add student</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <TeacherPageHeader
            title="Advisory Students"
            description={sections.length > 0 ? sections.map((s) => s.name).join(" · ") : "Academic overview for your advisory section."}
          />
          <React.Suspense fallback={<ZentraTableSkeleton rows={8} columns={5} />}>
            <AdvisoryGradesTable students={students} sections={sections} offeredSubjects={offeredSubjects} />
          </React.Suspense>
        </div>
      )}
    </section>
  );
}
