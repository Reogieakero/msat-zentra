"use client";

import { Button } from "@/components/ui/button";
import { initialsOf } from "@/services/teacher/admCases.labels";
import type { AdmCase } from "@/services/teacher/admCases.types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import cardStyles from "./AdmCaseCard.module.css";

interface AdmCaseCardProps {
  caseData: AdmCase;
  onDetails: () => void;
}

export function AdmCaseCard({ caseData, onDetails }: AdmCaseCardProps) {
  const initials = initialsOf(caseData.studentName);

  return (
    <article
      className={assign.card}
      aria-label={`ADM case for ${caseData.studentName}, ${caseData.approved ? "approved" : "pending approval"}`}
    >
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <span className={assign.cardHead}>
        <span className={assign.avatar} aria-hidden="true">
          {initials}
        </span>
        <span className={`${assign.claimMark} ml-auto self-start`}>
          <span
            className={assign.statusDot}
            style={{ backgroundColor: caseData.approved ? "#22c55e" : "#f59e0b" }}
            aria-hidden="true"
          />
          <span className={assign.claimLabel}>{caseData.approved ? "Approved" : "Pending"}</span>
        </span>
      </span>
      <span className={assign.teacherBlock}>
        <span className={`${assign.fieldLabel} ${cardStyles.studentName}`}>{caseData.studentName}</span>
        <span
          className={`${assign.itemTeacher} ${cardStyles.lrn}`}
          title={`LRN ${caseData.lrn}`}
        >
          LRN {caseData.lrn}
        </span>
      </span>
      <span className={`${assign.cardActions} justify-end`}>
        <Button type="button" size="sm" onClick={onDetails}>
          Track case
        </Button>
      </span>
    </article>
  );
}
