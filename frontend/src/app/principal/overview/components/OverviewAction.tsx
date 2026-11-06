"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Award,
  CalendarX,
  FileSignature,
  ShieldAlert,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { KanbanBoardHeader } from "@/components/ui/kanban-board";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTerm } from "@/lib/term/TermContext";
import { fetchOverview } from "@/services/principal/overview.service";
import styles from "./OverviewAction.module.css";

interface Action {
  key: string;
  icon: LucideIcon;
  title: string;
  /** Tooltip label — describes the queue, never the count. */
  label: string;
  blurb: string;
  count: number;
  href: string;
  cta: string;
}

/**
 * "Action required" — a kanban lane per follow-up queue (not a card grid).
 * Each lane lists its queue as a single actionable card; empty queues keep
 * the lane and state they are clear, mirroring the registry kanban boards.
 */
export function OverviewAction() {
  const { activeTerm } = useTerm();
  const { data, isPending, isError } = useQuery({
    queryKey: ["overview", activeTerm?.termId ?? null],
    queryFn: fetchOverview,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const actions: Action[] = [
    {
      key: "adm",
      icon: FileSignature,
      title: "ADM referrals",
      label: "Referrals awaiting principal review",
      blurb: "Referrals awaiting review",
      count: data?.admPending ?? 0,
      href: "/principal/adm/referrals/all",
      cta: "Review referrals",
    },
    {
      key: "attendance",
      icon: CalendarX,
      title: "Attendance watch",
      label: "Sections below the attendance threshold",
      blurb: "Sections below the attendance threshold",
      count: data?.attendanceWatch ?? 0,
      href: "/principal/risk/heatmaps/attendance",
      cta: "View sections",
    },
    {
      key: "honor",
      icon: Award,
      title: "Honor roll",
      label: "Qualifiers this term",
      blurb: "Qualifiers this term",
      count: data?.honorRoll ?? 0,
      href: "/principal/honor-roll",
      cta: "View honor roll",
    },
    {
      key: "risk",
      icon: ShieldAlert,
      title: "At-risk students",
      label: "Learners flagged by the risk engine",
      blurb: "Learners flagged this term",
      count: data?.atRisk?.students ?? 0,
      href: "/principal/risk/students",
      cta: "View at-risk",
    },
  ];

  const accountPending = data?.accountApprovals ?? 0;

  if (isPending) {
    return (
      <section className={styles.board} aria-busy="true" aria-label="Action required loading">
        <div className={styles.grid} style={{ ["--cols" as string]: actions.length }}>
          {actions.map((a) => (
            <div key={a.key} className={styles.column} aria-hidden="true">
              <div className={styles.headSkeleton}>
                <Skeleton className={styles.skelTitle} />
                <Skeleton className={styles.skelCount} />
              </div>
              <Skeleton className={styles.skelCard} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className={styles.board} aria-label="Action required">
        <p className={styles.empty}>Could not load overview figures.</p>
      </section>
    );
  }

  return (
    <section className={styles.board} aria-label="Action required">
      <div className={styles.grid} style={{ ["--cols" as string]: actions.length }}>
        {actions.map((a) => {
          const Icon = a.icon;
          const clear = a.count === 0;
          return (
            <div
              key={a.key}
              className={styles.column}
              aria-label={`${a.title}: ${a.count} pending`}
            >
              <KanbanBoardHeader
                icon={
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={styles.accent} aria-hidden>
                        <Icon size={14} />
                      </span>
                    </TooltipTrigger>
                    {/* Hover reveals the queue label, never the raw count. */}
                    <TooltipContent side="top" sideOffset={8}>
                      {a.label}
                    </TooltipContent>
                  </Tooltip>
                }
                title={a.title}
                count={a.count}
              />
              <ul className={styles.laneBody}>
                <li className={styles.laneItem}>
                  <Link
                    href={a.href}
                    className={`${styles.card} ${clear ? styles.cardClear : ""}`}
                    aria-label={
                      clear
                        ? `${a.title}: all caught up — ${a.cta}`
                        : `${a.title}: ${a.count} pending — ${a.cta}`
                    }
                  >
                    <span className={styles.cardHint}>
                      {clear ? "All caught up" : a.blurb}
                    </span>
                    <span className={styles.cardCta}>
                      <span className={styles.cardCtaText}>{a.cta}</span>
                      <ArrowRight className={styles.cardArrow} aria-hidden />
                    </span>
                  </Link>
                </li>
              </ul>
            </div>
          );
        })}
      </div>
      {accountPending === 0 ? null : (
        <p className={styles.footnote}>
          <UserCog className={styles.footnoteIcon} aria-hidden />
          {accountPending} pending account approval
          {accountPending !== 1 ? "s" : ""} this term.
        </p>
      )}
    </section>
  );
}
