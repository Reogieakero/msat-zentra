"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileSignature,
  CalendarX,
  Award,
  ShieldAlert,
  UserCog,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchOverview } from "./overview-data";
import { AuroraBanner } from "./AuroraBanner";
import styles from "./OverviewAction.module.css";

interface Action {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  blurb: string;
  count: number;
  href: string;
  cta: string;
}

export function OverviewAction() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["overview"],
    queryFn: fetchOverview,
  });

  const actions: Action[] = [
    {
      key: "adm",
      icon: FileSignature,
      title: "ADM Referred",
      blurb: "Referrals awaiting review",
      count: data?.admPending ?? 0,
      href: "/principal/adm/referrals/all",
      cta: "Review referrals",
    },
    {
      key: "attendance",
      icon: CalendarX,
      title: "Attendance Watch",
      blurb: "Sections below the attendance threshold",
      count: data?.attendanceWatch ?? 0,
      href: "/principal/risk/heatmaps/attendance",
      cta: "View sections",
    },
    {
      key: "honor",
      icon: Award,
      title: "Honor Roll",
      blurb: "Qualifiers this term",
      count: data?.honorRoll ?? 0,
      href: "/principal/academics",
      cta: "View honor roll",
    },
    {
      key: "risk",
      icon: ShieldAlert,
      title: "At-Risk Students",
      blurb: "Learners flagged this term",
      count: data?.atRisk.students ?? 0,
      href: "/principal/risk",
      cta: "View at-risk",
    },
  ];

  return (
    <section aria-label="Action required" className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>Action required</h2>
        <p className={styles.description}>
          Follow-ups that need principal attention this term.
        </p>
      </div>
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
              const empty = a.count === 0;
              return (
                <AuroraBanner
                  key={a.key}
                  icon={a.icon}
                  pill={a.title}
                  count={a.count}
                  title={empty ? `All caught up — ${a.blurb.toLowerCase()}` : a.blurb}
                  cta={empty ? "View" : a.cta}
                  href={a.href}
                  label={
                    empty
                      ? `${a.title}: all caught up`
                      : `${a.title}: ${a.count} pending`
                  }
                />
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
    </section>
  );
}
