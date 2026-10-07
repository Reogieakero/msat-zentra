"use client";

import * as React from "react";
import { AdvisoryGradesTable } from "./components/AdvisoryGradesTable";
import { useAdvisoryRoster } from "@/services/teacher/advisory.service";

/* Advisory students — roster-wide per-subject live grades table (realtime
   mean of recorded scores, lock-agnostic). Student names link to their
   academic record. */
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
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading students">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 rounded-md bg-muted" />
          ))}
        </div>
      ) : rosterQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          No advisory section assigned, or it could not be loaded. Contact the school
          office.
        </p>
      ) : (
        <AdvisoryGradesTable students={students} sections={sections} offeredSubjects={offeredSubjects} />
      )}
    </section>
  );
}
