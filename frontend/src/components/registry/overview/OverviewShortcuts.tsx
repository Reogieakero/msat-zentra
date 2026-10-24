"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  FileSignature,
  FileStack,
  GraduationCap,
  ShieldQuestion,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoardHeader } from "@/components/ui/kanban-board";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import {
  fetchRecordKeeperOverview,
  fetchRegistrarOverview,
  type RegistryDesk,
} from "@/services/registry/overview.service";
import styles from "./OverviewShortcuts.module.css";

interface ShortcutItem {
  key: string;
  icon: LucideIcon;
  title: string;
  count: number;
  href: string;
  hint: string;
  cta: string;
  accent: string;
  /** Decorative sprite shown in the stats variant — pinned per queue. */
  mascot: string;
}

export function OverviewShortcuts({
  desk,
  variant = "actions",
}: {
  desk: RegistryDesk;
  /**
   * "actions" (default) — count header + action-link card per queue.
   * "stats" — number-first columns with no links, for desks whose right
   * icon rail already owns the quick actions (record-keeper overview).
   */
  variant?: "actions" | "stats";
}) {
  const pathname = usePathname();
  const label = variant === "stats" ? "Approval stats" : "Approval shortcuts";
  const { data, isPending, isError } = useQuery({
    queryKey: [`${desk}-overview`],
    queryFn: desk === "registrar" ? fetchRegistrarOverview : fetchRecordKeeperOverview,
    staleTime: 30_000,
  });

  if (isPending) {
    return (
      <section
        className={styles.board}
        data-variant={variant}
        aria-busy="true"
        aria-label={`${label} loading`}
      >
        <div className={styles.kanbanGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.column} aria-hidden="true">
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
      <section className={styles.board} data-variant={variant} aria-label={label}>
        <p className={styles.empty}>
          Could not load {variant === "stats" ? "stats" : "shortcuts"}.
        </p>
      </section>
    );
  }

  const items: ShortcutItem[] = [
    {
      key: "finals",
      icon: FileSignature,
      title: "Final Grade Approvals",
      count: data?.lockedFinalsAwaiting ?? 0,
      href: `/${desk}/final-grades`,
      hint: "Ready to view",
      cta: "Open queue",
      accent: "text-primary",
      mascot: "owl",
    },
    {
      key: "students",
      icon: GraduationCap,
      title: "Pending Students",
      count: data?.pendingStudents.length ?? 0,
      href: `/${desk}/accounts`,
      hint: "Awaiting decision",
      cta: "Review accounts",
      accent: "text-blue-500",
      mascot: "scout",
    },
    {
      key: "adviser",
      icon: ShieldQuestion,
      title: "Adviser Access",
      count: data?.pendingAdviserAccess ?? 0,
      href: `/${desk}/adviser-access`,
      hint: "Requests to review",
      cta: "Review requests",
      accent: "text-amber-500",
      mascot: "knight",
    },
    {
      key: "sf10",
      icon: FileStack,
      title: "SF10 Records to Attach",
      count: data?.latestAttachments.length ?? 0,
      href: `/${desk}/sf10`,
      hint: "Files in flight",
      cta: "Open records",
      accent: "text-emerald-600 dark:text-emerald-400",
      mascot: "postbot",
    },
  ];

  return (
    <section className={styles.board} data-variant={variant} aria-label={label}>
      <div className={styles.kanbanGrid} style={{ ["--cols" as string]: items.length }}>
        {items.map((a) => {
          const Icon = a.icon;
          if (variant === "stats") {
            return (
              <div
                key={a.key}
                className={styles.column}
                aria-label={`${a.title}, ${a.count} pending`}
              >
                <KanbanBoardHeader
                  icon={<Icon size={14} className={a.accent} aria-hidden />}
                  title={a.title}
                />
                <div className={styles.stat}>
                  <span className={styles.statTop}>
                    <span
                      className={`${styles.statNumber} ${
                        a.count === 0 ? styles.statNumberZero : ""
                      }`}
                    >
                      {a.count}
                    </span>
                    <span className={styles.statMascot} aria-hidden="true">
                      <StudentMascot name={a.title} character={a.mascot} size={36} />
                    </span>
                  </span>
                  <span className={styles.statHint}>{a.hint}</span>
                </div>
              </div>
            );
          }
          const active = pathname === a.href || pathname.startsWith(`${a.href}/`);
          return (
            <div
              key={a.key}
              className={`${styles.column} ${active ? styles.columnActive : ""}`}
              aria-label={`${a.title}, ${a.count} pending`}
            >
              <KanbanBoardHeader
                icon={<Icon size={14} className={a.accent} aria-hidden />}
                title={a.title}
                count={a.count}
              />
              <ul className={styles.laneBody}>
                <li className={styles.laneItem}>
                  <Link
                    href={a.href}
                    className={styles.card}
                    aria-current={active ? "page" : undefined}
                    aria-label={
                      a.count === 0
                        ? `${a.title}: all caught up — ${a.cta}`
                        : `${a.title}: ${a.count} pending — ${a.cta}`
                    }
                  >
                    <span className={styles.cardHint}>{a.hint}</span>
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
      {variant !== "stats" && (
        <p className={styles.footnote}>
          <UserCog className={styles.footnoteIcon} aria-hidden />
          {data?.pendingAccounts ?? 0} pending account request
          {(data?.pendingAccounts ?? 0) !== 1 ? "s" : ""} across the grade band.
        </p>
      )}
    </section>
  );
}
