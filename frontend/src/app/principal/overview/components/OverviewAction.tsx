"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  FileSignature,
  CalendarX,
  Award,
  ShieldAlert,
  ArrowRight,
  UserCog,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchOverview } from "./overview-data";
import styles from "./OverviewAction.module.css";

interface Action {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
  href: string;
  cta: string;
}

export function OverviewAction() {
  const router = useRouter();
  const { data, isPending, isError } = useQuery({
    queryKey: ["overview"],
    queryFn: fetchOverview,
  });

  const actions: Action[] = [
    {
      key: "adm",
      icon: FileSignature,
      title: "ADM Referred",
      count: data?.admPending ?? 0,
      href: "/principal/adm/referrals/all",
      cta: "Review referrals",
    },
    {
      key: "attendance",
      icon: CalendarX,
      title: "Attendance Watch",
      count: data?.attendanceWatch ?? 0,
      href: "/principal/risk/heatmaps/attendance",
      cta: "View sections",
    },
    {
      key: "honor",
      icon: Award,
      title: "Honor Roll",
      count: data?.honorRoll ?? 0,
      href: "/principal/academics",
      cta: "View honor roll",
    },
    {
      key: "risk",
      icon: ShieldAlert,
      title: "At-Risk Students",
      count: data?.atRisk.students ?? 0,
      href: "/principal/risk",
      cta: "View at-risk",
    },
  ];

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <CardTitle>Action required</CardTitle>
          <CardDescription>
            Follow-ups that need principal attention this term.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className={styles.content}>
        {isPending ? (
          <div className={styles.actionGrid}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className={styles.actionSkel} />
            ))}
          </div>
        ) : isError ? (
          <p className={styles.empty}>Could not load overview figures.</p>
        ) : (
          <>
            <div className={styles.actionGrid}>
              {actions.map((a) => {
                const Icon = a.icon;
                const empty = a.count === 0;
                return (
                  <button
                    type="button"
                    key={a.key}
                    className={styles.actionItem}
                    onClick={() => router.push(a.href)}
                    aria-label={
                      empty ? `${a.title}: all caught up` : `${a.title}: ${a.count} pending`
                    }
                  >
                    <span className={styles.actionHead}>
                      <span className={styles.actionIcon}>
                        <Icon className={styles.actionIconSvg} aria-hidden />
                      </span>
                      <span className={styles.actionCount}>{a.count}</span>
                    </span>
                    <span className={styles.actionTitle}>{a.title}</span>
                    <span className={styles.actionCta}>
                      {empty ? "View" : a.cta}
                      <ArrowRight className={styles.actionCtaIcon} aria-hidden />
                    </span>
                  </button>
                );
              })}
            </div>
            <p className={styles.footnote}>
              <UserCog className={styles.footnoteIcon} aria-hidden />
              {data?.accountApprovals ?? 0} pending account approval
              {(data?.accountApprovals ?? 0) !== 1 ? "s" : ""} this term.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}