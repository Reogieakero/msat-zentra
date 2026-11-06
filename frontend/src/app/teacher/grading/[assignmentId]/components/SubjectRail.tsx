"use client";

import * as React from "react";
import Link from "next/link";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeacherOverviewGradebook } from "@/services/teacher/overview.service";
import { gradebookSlug } from "@/lib/gradebookSlug";

/**
 * Horizontal subject-gradebook switcher: one compact code card per subject
 * of the user. The picked card reads highlighted; the row lives in the
 * workspace toolbar, aligned with the search bar.
 */
export function SubjectRail({ currentId }: { currentId: string }) {
  const gradebook = useTeacherOverviewGradebook();
  const classes = gradebook.data?.classes ?? [];
  const [pickedId, setPickedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPickedId(null);
  }, [currentId]);

  if (gradebook.isError || (!gradebook.isPending && classes.length === 0)) {
    return null;
  }

  const target = pickedId ?? currentId;
  const isActive = (row: { id: string; subject: string; section: string }) =>
    row.id === target || gradebookSlug(row) === target;

  return (
    <div
      className="flex min-w-0 flex-row gap-2 overflow-x-auto pb-0.5"
      role="group"
      aria-label="Subject gradebooks"
    >
      {gradebook.isPending
        ? [0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[54px] w-40 shrink-0 rounded-lg" aria-hidden />
          ))
        : classes.map((c) => {
            const active = isActive(c);
            const code = c.subjectCode?.trim() || c.subject;
            return (
              <Link
                key={c.id}
                href={`/teacher/grading/${gradebookSlug(c)}`}
                onClick={() => setPickedId(c.id)}
                aria-current={active ? "page" : undefined}
                aria-label={`${c.subject} — ${c.section}, ${c.gradeLevel}${active ? " (current)" : ""}`}
                title={`${c.subject} — ${c.section} · ${c.gradeLevel}`}
                className={`flex min-w-0 max-w-52 shrink-0 cursor-pointer flex-col justify-center gap-1 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                  active
                    ? "border-amber-500/60 bg-amber-500/10"
                    : "border-border bg-card hover:border-amber-500/60 hover:bg-amber-500/10"
                }`}
              >
                <span
                  className={`truncate text-xs font-bold tracking-wide ${
                    active
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-muted-foreground"
                  }`}
                >
                  {code}
                </span>
                <span className="flex min-w-0 items-center gap-1">
                  <Pill tone="amber" label="Section" className="min-w-0 truncate">
                    {c.section}
                  </Pill>
                  <Pill tone="neutral" label="Grade level">
                    {c.gradeLevel}
                  </Pill>
                </span>
              </Link>
            );
          })}
    </div>
  );
}
