"use client";

import { Pill } from "@/components/ui/pill";

export interface SectionTab {
  id: string;
  name: string;
  gradeLevel: string | null;
}

/**
 * Horizontal section switcher, mirroring the grading workspace's SubjectRail:
 * one compact card per section the teacher takes attendance for, the active
 * one reading amber. Kept at the top-left of the sheet so a teacher can hop
 * sections without opening the subjects gutter.
 */
export function SectionTabs({
  sections,
  activeSectionId,
  onSelect,
}: {
  sections: SectionTab[];
  activeSectionId: string | null;
  onSelect: (sectionId: string) => void;
}) {
  if (sections.length === 0) return null;

  return (
    <div
      className="flex min-w-0 flex-row gap-2 overflow-x-auto pb-0.5"
      role="tablist"
      aria-label="Filter attendance by section"
    >
      {sections.map((section) => {
        const active = section.id === activeSectionId;
        return (
          <button
            key={section.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`${section.name}${active ? " (current)" : ""}`}
            title={section.name}
            onClick={() => onSelect(section.id)}
            className={`flex min-w-0 max-w-52 shrink-0 cursor-pointer flex-col justify-center gap-1 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
              active
                ? "border-amber-500/60 bg-amber-500/10"
                : "border-border bg-card hover:border-amber-500/60 hover:bg-amber-500/10"
            }`}
          >
            <span
              className={`truncate text-xs font-bold tracking-wide ${
                active ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"
              }`}
            >
              {section.name}
            </span>
            {section.gradeLevel ? (
              <span className="flex min-w-0 items-center gap-1">
                <Pill tone="amber" label="Grade level">
                  {section.gradeLevel}
                </Pill>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
