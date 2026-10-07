"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  FileSignature,
  FileStack,
  GraduationCap,
  ShieldQuestion,
  UserCog,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchRegistrarOverview } from "@/services/registry/overview.service";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./OverviewShortcuts.module.css";

interface ShortcutItem {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
  href: string;
  hint: string;
}

export function OverviewShortcuts() {
  const pathname = usePathname();
  const { data, isPending, isError } = useQuery({
    queryKey: ["registrar-overview"],
    queryFn: fetchRegistrarOverview,
    staleTime: 30_000,
  });

  if (isPending) {
    return (
      <section className={assign.card} aria-label="Approval shortcuts loading">
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <ul className={styles.grid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i}>
              <Skeleton className={styles.skel} />
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (isError) {
    return (
      <section className={assign.card} aria-label="Approval shortcuts">
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <p className={`${styles.empty} relative`}>Could not load shortcuts.</p>
      </section>
    );
  }

  const items: ShortcutItem[] = [
    {
      key: "finals",
      icon: FileSignature,
      title: "Final Grade Approvals",
      count: data?.lockedFinalsAwaiting ?? 0,
      href: "/registrar/final-grades",
      hint: "Ready to view",
    },
    {
      key: "students",
      icon: GraduationCap,
      title: "Pending Students",
      count: data?.pendingStudents.length ?? 0,
      href: "/registrar/accounts",
      hint: "Awaiting decision",
    },
    {
      key: "adviser",
      icon: ShieldQuestion,
      title: "Adviser Access",
      count: data?.pendingAdviserAccess ?? 0,
      href: "/registrar/adviser-access",
      hint: "Requests to review",
    },
    {
      key: "sf10",
      icon: FileStack,
      title: "SF10 Records to Attach",
      count: data?.latestAttachments.length ?? 0,
      href: "/registrar/sf10",
      hint: "Files in flight",
    },
  ];

  return (
    <section className={assign.card} aria-label="Approval shortcuts">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <nav aria-label="Approval shortcuts" className="relative w-full">
        <ul className={styles.grid}>
          {items.map((a) => {
            const Icon = a.icon;
            const active =
              pathname === a.href || pathname.startsWith(`${a.href}/`);
            return (
              <li key={a.key}>
                <Link
                  href={a.href}
                  className={`${styles.tile} ${active ? styles.tileActive : ""}`}
                  aria-current={active ? "page" : undefined}
                  aria-label={
                    a.count === 0
                      ? `${a.title}: all caught up`
                      : `${a.title}: ${a.count} pending`
                  }
                >
                  <span className={styles.tileTop}>
                    <Icon className={styles.icon} aria-hidden="true" />
                    <span className={styles.count}>{a.count}</span>
                  </span>
                  <span className={styles.label}>{a.title}</span>
                  <span className={styles.hint}>{a.hint}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <p className={`${styles.footnote} relative`}>
        <UserCog className={styles.footnoteIcon} aria-hidden />
        {data?.pendingAccounts ?? 0} pending account request
        {(data?.pendingAccounts ?? 0) !== 1 ? "s" : ""} across the grade band.
      </p>
    </section>
  );
}
