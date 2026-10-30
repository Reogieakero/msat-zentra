"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpenCheck,
  CalendarCheck,
  GraduationCap,
  School,
  Users,
  type LucideIcon,
} from "lucide-react";
import { KanbanBoardHeader } from "@/components/ui/kanban-board";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTerm } from "@/lib/term/TermContext";
import { fetchOverview } from "@/services/principal/overview.service";
import { CountUpNumber } from "./CountUpNumber";
import styles from "./PrincipalOverviewStats.module.css";

interface StatItem {
  key: string;
  icon: LucideIcon;
  title: string;
  /** Tooltip label — describes the metric, deliberately never the number. */
  label: string;
  value: number;
  hint: string;
  /** Decorative sprite shown beside the number — pinned per metric. */
  mascot: string;
}

/**
 * Top kanban strip of the principal overview — one number-first column per
 * school-health metric, mirroring the registry desk KPI boards
 * (OverviewShortcuts "stats" variant). Amber is the desk accent; the hover
 * tooltip carries the metric label only, never the raw value.
 */
export function PrincipalOverviewStats() {
  const { activeTerm } = useTerm();
  const { data, isPending, isError } = useQuery({
    queryKey: ["overview", activeTerm?.termId ?? null],
    queryFn: fetchOverview,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const items: StatItem[] = [
    {
      key: "enrollment",
      icon: GraduationCap,
      title: "Enrolled",
      label: "Learners enrolled this school year",
      value: data?.kpis.enrollment ?? 0,
      hint: "Learners on the roll",
      mascot: "owl",
    },
    {
      key: "sections",
      icon: School,
      title: "Sections",
      label: "Active sections this school year",
      value: data?.kpis.activeSections ?? 0,
      hint: "Active class sections",
      mascot: "knight",
    },
    {
      key: "teachers",
      icon: Users,
      title: "Teachers",
      label: "Teaching staff assigned this term",
      value: data?.kpis.teachers ?? 0,
      hint: "Assigned teaching staff",
      mascot: "scientist",
    },
    {
      key: "anecdotals",
      icon: BookOpenCheck,
      title: "Anecdotals",
      label: "Anecdotal records filed this term",
      value: data?.kpis.anecdotals ?? 0,
      hint: "Records filed this term",
      mascot: "postbot",
    },
  ];

  if (isPending) {
    return (
      <section className={styles.board} aria-busy="true" aria-label="School health loading">
        <div className={styles.grid} style={{ ["--cols" as string]: items.length }}>
          {items.map((s) => (
            <div key={s.key} className={styles.column} aria-hidden="true">
              <div className={styles.headSkeleton}>
                <Skeleton className={styles.skelTitle} />
              </div>
              <Skeleton className={styles.skelStat} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className={styles.board} aria-label="School health">
        <p className={styles.empty}>Could not load school health figures.</p>
      </section>
    );
  }

  return (
    <section className={styles.board} aria-label="School health">
      <div className={styles.grid} style={{ ["--cols" as string]: items.length }}>
        {items.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.key}
              className={styles.column}
              aria-label={`${s.title}: ${s.value}`}
            >
              <KanbanBoardHeader
                icon={
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={styles.icon} aria-hidden>
                        <Icon size={14} />
                      </span>
                    </TooltipTrigger>
                    {/* Hover reveals the metric label, never the raw value. */}
                    <TooltipContent side="top" sideOffset={8}>
                      {s.label}
                    </TooltipContent>
                  </Tooltip>
                }
                title={s.title}
              />
              <div className={styles.stat}>
                <span className={styles.statTop}>
                  <CountUpNumber
                    className={`${styles.statNumber} ${
                      s.value === 0 ? styles.statNumberZero : ""
                    }`}
                    value={s.value}
                  />
                  <span className={styles.statMascot} aria-hidden="true">
                    <StudentMascot name={s.title} character={s.mascot} size={36} />
                  </span>
                </span>
                <span className={styles.statHint}>{s.hint}</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className={styles.footnote}>
        <CalendarCheck className={styles.footnoteIcon} aria-hidden />
        Live for the active term — hover a column to read what it measures.
      </p>
    </section>
  );
}
