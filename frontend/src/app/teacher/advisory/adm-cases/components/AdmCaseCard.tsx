"use client";

import { Button } from "@/components/ui/button";
import type { AdmCase } from "@/services/teacher/admCases.types";
import { StudentMascot } from "../../referrals/components/StudentMascot";

interface AdmCaseCardProps {
  caseData: AdmCase;
  onDetails: () => void;
}

export function AdmCaseCard({ caseData, onDetails }: AdmCaseCardProps) {
  return (
    <article
      aria-label={`ADM case for ${caseData.studentName}, ${caseData.stageLabel}`}
      className="flex min-w-0 flex-col items-center gap-2 rounded-lg border bg-white p-3 text-center shadow-sm transition-colors hover:border-primary/60 hover:shadow dark:bg-card"
    >
      <StudentMascot
        name={caseData.studentName}
        seed={caseData.lrn}
        character={caseData.mascot ?? undefined}
        size={96}
      />
      <button
        type="button"
        onClick={onDetails}
        aria-label={`Track ADM case for ${caseData.studentName}`}
        className="w-full cursor-pointer truncate text-center text-sm font-semibold text-foreground"
        title={caseData.studentName}
      >
        {caseData.studentName}
      </button>
      <span
        className="inline-flex max-w-full items-center truncate rounded-md border border-border bg-secondary px-2 py-0.5 text-xs font-medium leading-tight text-secondary-foreground"
        title={`LRN ${caseData.lrn}`}
      >
        {caseData.lrn}
      </span>
      <div className="flex w-full justify-end">
        <Button
          type="button"
          onClick={onDetails}
          className="h-6 text-xs"
        >
          Track case
        </Button>
      </div>
    </article>
  );
}
