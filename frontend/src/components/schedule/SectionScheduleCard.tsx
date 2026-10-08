"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { STATUS_META } from "@/app/principal/academics/assign/components/status-dots";
import emptyStyles from "@/app/teacher/schedule/schedule-empty.module.css";

export type TimetableSlotStatus = "DRAFT" | "SUBMITTED" | "APPROVED";

export interface StatusEntry {
  status: TimetableSlotStatus;
  reviewNote?: string | null;
}

export type SectionCardStatus = "submitted" | "returned" | "approved" | "draft" | "empty";

export function sectionCardStatus(entries: StatusEntry[]): SectionCardStatus {
  if (entries.some((e) => e.status === "SUBMITTED")) return "submitted";
  if (entries.some((e) => e.reviewNote)) return "returned";
  if (entries.length === 0) return "empty";
  if (entries.every((e) => e.status === "APPROVED")) return "approved";
  return "draft";
}

export const SECTION_CARD_STATUS_META: Record<
  SectionCardStatus,
  { color: string; label: string }
> = {
  submitted: { color: STATUS_META.progress.color, label: "Submitted" },
  returned: { color: "#f59e0b", label: "Returned" },
  approved: { color: STATUS_META.success.color, label: "Approved" },
  draft: { color: STATUS_META.error.color, label: "Draft" },
  empty: { color: STATUS_META.idle.color, label: "Empty" },
};

export const GRADE_GRADIENT: Record<string, { from: string; to: string }> = {
  G7: { from: "#22c55e", to: "#16a34a" },
  G8: { from: "#f59e0b", to: "#d9770f" },
  G9: { from: "#ef4444", to: "#dc2626" },
  G10: { from: "#3b82f6", to: "#2563d1" },
  G11: { from: "#ec4899", to: "#db2777" },
  G12: { from: "#8b5cf6", to: "#7c3aed" },
};

export function sectionInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : (parts[0]?.[1] ?? "");
  return `${first}${second}`.toUpperCase();
}

interface SectionScheduleCardProps {
  href?: string;
  onSelect?: () => void;
  selected?: boolean;
  ariaLabel: string;
  gradeLevel?: string | null;
  pill?: ReactNode;
  avatarIcon?: ReactNode;
  titleLabel?: string;
  sectionName: string;
  adviserName: string | null;
  timetableEntries?: StatusEntry[];
  statusMeta?: { color: string; label: string };
  hint?: string | null;
  middle?: ReactNode;
  children?: ReactNode;
  tone?: "primary" | "green";
}

export function SectionScheduleCard({
  href,
  onSelect,
  selected,
  ariaLabel,
  gradeLevel,
  pill,
  avatarIcon,
  titleLabel = "Section",
  sectionName,
  adviserName,
  timetableEntries,
  statusMeta,
  hint,
  middle,
  children,
  tone = "primary",
}: SectionScheduleCardProps) {
  const status = timetableEntries ? sectionCardStatus(timetableEntries) : "empty";
  const meta = statusMeta ?? SECTION_CARD_STATUS_META[status];
  const selectedClass =
    onSelect && selected
      ? tone === "green"
        ? emptyStyles.pickSelectedGreen
        : emptyStyles.pickSelected
      : "";
  const className = `${assign.card} ${emptyStyles.pickOption} ${selectedClass}`;
  const inner = (
    <>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      {pill ?? (gradeLevel ? (
        <Badge
          variant="secondary"
          className={`${assign.gradeBadge} ${assign.gradeFloat}`}
          style={{
            backgroundColor: "var(--primary)",
            color: "var(--primary-foreground)",
            borderColor: "transparent",
          }}
        >
          Grade {gradeLevel.replace("G", "")}
        </Badge>
      ) : null)}
      <span className={assign.cardHead}>
        <span className={assign.avatar} aria-hidden="true">
          {avatarIcon ?? sectionInitials(sectionName)}
        </span>
        <span className={assign.cardTitleBlock}>
          <span className={assign.fieldLabel}>{titleLabel}</span>
          <span className={assign.itemName} title={sectionName}>
            {sectionName}
          </span>
        </span>
        <span className={assign.claimMark}>
          <span
            className={assign.statusDot}
            style={{ backgroundColor: meta.color }}
            aria-hidden="true"
          />
          <span className={assign.claimLabel}>{meta.label}</span>
        </span>
      </span>
      {middle ?? (
        <span className={assign.teacherBlock}>
          <span className={assign.fieldLabel}>Teacher</span>
          <span className={assign.itemTeacher} title={adviserName ?? undefined}>
            {adviserName ? (
              adviserName
            ) : (
              <span className={assign.itemTerm}>No adviser</span>
            )}
          </span>
        </span>
      )}
      {hint ? <span className={assign.itemTerm}>{hint}</span> : null}
      {children}
    </>
  );
  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected ?? false}
        aria-label={ariaLabel}
        className={className}
      >
        {inner}
      </button>
    );
  }
  if (href) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel}
        className={className}
      >
        {inner}
      </Link>
    );
  }
  return (
    <article aria-label={ariaLabel} className={className}>
      {inner}
    </article>
  );
}
