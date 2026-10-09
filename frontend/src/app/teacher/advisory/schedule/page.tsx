"use client";

import * as React from "react";
import { AdvisorySectionSchedule } from "@/app/teacher/overview/components/teacher-overview-section-schedule";

export default function AdvisorySchedulePage() {
  const [blankSection, setBlankSection] = React.useState(false);
  return (
    <section className="flex w-full min-w-0 flex-1 flex-col gap-4" aria-label="Class Schedule">
      {blankSection ? null : (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Class Schedule</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Weekly timetable for your advisory section.
          </p>
        </div>
      )}
      <AdvisorySectionSchedule onEmptyChange={setBlankSection} />
    </section>
  );
}
