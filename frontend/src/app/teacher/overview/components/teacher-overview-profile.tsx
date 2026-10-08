"use client";
import * as React from "react";
import { BookOpen, GraduationCap, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTeacherProfileSettings } from "@/services/settings/profile-settings";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { GRADE_GRADIENT } from "@/components/schedule/SectionScheduleCard";
import type { AdvisorySectionInfo } from "@/services/teacher/overview.types";
import styles from "./teacher-overview-header.module.css";
interface TeacherOverviewHeaderProps {
  teacherName: string;
  advisorySection?: AdvisorySectionInfo | null;
  classCount?: number;
  studentCount?: number;
}
function StatChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className={styles.stat}>
      <Icon className={styles.statIcon} aria-hidden />
      <div className={styles.statText}>
        <span className={styles.statValue}>{value}</span>
        <span className={styles.statLabel}>{label}</span>
      </div>
    </div>
  );
}
export function TeacherOverviewHeader({
  teacherName,
  advisorySection,
  classCount = 0,
  studentCount = 0,
}: TeacherOverviewHeaderProps) {
  const profile = useTeacherProfileSettings();
  const photoUrl = profile.data?.photoUrl ?? null;
  const isAdviser = Boolean(advisorySection);
  const initials = React.useMemo(() => {
    const parts = teacherName
      .split(/\s+/)
      .filter(Boolean)
      .filter((p) => !/^mr\.?$|^mrs\.?$|^ms\.?$|^dr\.?$/i.test(p));
    const picks = parts.slice(0, 2);
    return (picks.length ? picks : [teacherName])
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
  }, [teacherName]);
  const grad = advisorySection?.gradeLevel
    ? (GRADE_GRADIENT[advisorySection.gradeLevel] ?? null)
    : null;
  return (
    <article
      className={assign.card}
      aria-label="Teacher profile"
      style={
        grad
          ? {
              borderColor: `color-mix(in oklch, ${grad.from} 40%, transparent)`,
              background: `linear-gradient(135deg, color-mix(in oklch, ${grad.from} 16%, var(--card)), color-mix(in oklch, ${grad.to} 10%, var(--card)))`,
            }
          : undefined
      }
    >
      <span className={assign.glowClip} aria-hidden="true">
        <span
          className={assign.cardGlow}
          style={
            grad
              ? {
                  background: `radial-gradient(ellipse at center, color-mix(in oklch, ${grad.from} 45%, transparent), transparent 70%)`,
                }
              : undefined
          }
        />
      </span>
      <Badge
        variant="secondary"
        className={`${assign.gradeBadge} ${assign.gradeFloat}`}
        style={
          grad
            ? {
                backgroundColor: grad.from,
                color: "#ffffff",
                borderColor: "transparent",
              }
            : {
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
                borderColor: "transparent",
              }
        }
      >
        {isAdviser ? "Adviser" : "Teacher"}
      </Badge>
      <div className="relative flex flex-col gap-1">
        <div className={assign.cardHead}>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={`${teacherName} profile photo`}
              className="h-11 w-11 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className={assign.avatar} aria-hidden="true">
              {initials || "T"}
            </span>
          )}
          <span className={assign.cardTitleBlock}>
            <span className={assign.fieldLabel}>Teacher</span>
            <span className={assign.itemName} title={teacherName}>
              {teacherName}
            </span>
          </span>
        </div>
        {isAdviser && advisorySection ? (
          <p className={styles.advisory}>
            <GraduationCap className={styles.advisoryIcon} aria-hidden />
            You are adviser of <span>{advisorySection.name}</span>
          </p>
        ) : (
          <p className={styles.advisoryMuted}>
            Not assigned as a section adviser this term.
          </p>
        )}
      </div>
      <div className={`${styles.profileFoot} relative`}>
        <StatChip icon={BookOpen} label="Classes" value={String(classCount)} />
        <span className={styles.statDivider} aria-hidden />
        <StatChip icon={Users} label="Students" value={String(studentCount)} />
      </div>
    </article>
  );
}
