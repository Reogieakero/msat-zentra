"use client";

import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
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
        aria-label={`Monitor ADM case for ${caseData.studentName}`}
        className="w-full cursor-pointer truncate text-center text-sm font-semibold text-foreground"
        title={caseData.studentName}
      >
        {caseData.studentName}
      </button>
      <Pill tone="neutral" label="LRN" className="max-w-full whitespace-normal text-center leading-tight">
        {caseData.lrn}
      </Pill>
      <div className="flex w-full justify-end">
        <Button
          type="button"
          onClick={onDetails}
          aria-label={`Monitor ADM case for ${caseData.studentName}`}
          className="h-6 text-xs"
        >
          Monitor
        </Button>
      </div>
    </article>
  );
}
