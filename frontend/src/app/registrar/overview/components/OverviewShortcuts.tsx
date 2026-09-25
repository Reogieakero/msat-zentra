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
import { fetchRegistrarOverview } from "./overview-data";
import styles from "./OverviewShortcuts.module.css";

interface ShortcutItem {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
  href: string;
}

export function OverviewShortcuts() {
  const pathname = usePathname();
  const { data, isPending, isError } = useQuery({
    queryKey: ["registrar-overview"],
    queryFn: fetchRegistrarOverview,
  });

  if (isPending) {
    return (
      <section className={styles.sidebar} aria-label="Approval shortcuts loading">
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
      <section className={styles.sidebar} aria-label="Approval shortcuts">
        <p className={styles.empty}>Could not load shortcuts.</p>
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
    },
    {
      key: "students",
      icon: GraduationCap,
      title: "Pending Students",
      count: data?.pendingStudents.length ?? 0,
      href: "/registrar/accounts",
    },
    {
      key: "adviser",
      icon: ShieldQuestion,
      title: "Adviser Access",
      count: data?.pendingAdviserAccess ?? 0,
      href: "/registrar/adviser-access",
    },
    {
      key: "sf10",
      icon: FileStack,
      title: "SF10 Records to Attach",
      count: data?.latestAttachments.length ?? 0,
      href: "/registrar/sf10",
    },
  ];

  return (
    <section className={styles.sidebar} aria-label="Approval shortcuts">
      <nav aria-label="Approval shortcuts">
        <ul className={styles.grid}>
          {items.map((a) => {
            const Icon = a.icon;
            const active =
              pathname === a.href || pathname.startsWith(`${a.href}/`);
            return (
              <li key={a.key}>
                <Link
                  href={a.href}
                  className={`${styles.item} ${active ? styles.itemActive : ""}`}
                  aria-current={active ? "page" : undefined}
                  aria-label={
                    a.count === 0
                      ? `${a.title}: all caught up`
                      : `${a.title}: ${a.count} pending`
                  }
                >
                  <Icon className={styles.icon} aria-hidden="true" />
                  <span className={styles.label}>{a.title}</span>
                  <span className={styles.badge}>{a.count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <p className={styles.footnote}>
        <UserCog className={styles.footnoteIcon} aria-hidden />
        {data?.pendingAccounts ?? 0} pending account request
        {(data?.pendingAccounts ?? 0) !== 1 ? "s" : ""} across the grade band.
      </p>
    </section>
  );
}
