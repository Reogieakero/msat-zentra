"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type AssessmentAudience = "regular" | "adm";

const OPTIONS: { value: AssessmentAudience; label: string; hint: string }[] = [
  { value: "regular", label: "Regular", hint: "Assessments graded for regular learners" },
  { value: "adm", label: "ADM", hint: "Assessments graded for signed ADM learners" },
];

type Props = {
  value: AssessmentAudience;
  onChange: (audience: AssessmentAudience) => void;
};

/**
 * Filters the assessment list by grade input type. Two 24px UI buttons:
 * the active audience reads primary, the other secondary.
 */
export function AudienceTabs({ value, onChange }: Props) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5" role="tablist" aria-label="Assessment type">
      {OPTIONS.map((o) => (
        <Tooltip key={o.value}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              role="tab"
              aria-selected={value === o.value}
              aria-label={o.hint}
              variant={value === o.value ? "default" : "secondary"}
              size="xs"
              className="h-6 rounded-full px-3 text-xs"
              onClick={() => onChange(o.value)}
            >
              {o.label}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">{o.hint}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
