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
import { useTerm } from "@/lib/term/TermContext";
import { fetchOverview } from "@/services/principal/overview.service";
import { AuroraBanner } from "./AuroraBanner";
import { PrincipalEmptyCard } from "../../components/PrincipalEmptyCard";
import styles from "./OverviewAction.module.css";

interface Action {
  key: string;
  icon: import("lucide-react").LucideIcon;
  title: string;
  blurb: string;
  count: number;
  href: string;
  cta: string;
}

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
      count: data?.atRisk?.students ?? 0,
      href: "/principal/risk",
      cta: "View at-risk",
    },
  ];

  const allEmpty = !data || actions.every((a) => a.count === 0);
  const accountPending = data?.accountApprovals ?? 0;

  const spotlight = React.useMemo(() => {
    const rows = [...(data?.riskByGrade ?? [])].sort((a, b) => b.count - a.count);
    return rows.length > 0 && rows[0].count > 0 ? rows[0] : null;
  }, [data]);
  const honorCount = data?.honorRoll ?? 0;
  const emptyCopy: Record<string, { title: string; hint: string }> = {
    adm: { title: "No referrals awaiting review", hint: "No ADM referrals awaiting review this term." },
    attendance: { title: "No attendance flags", hint: "No sections below the attendance threshold this term." },
    honor: { title: "No honor roll qualifiers", hint: "No honor roll qualifiers this term." },
    risk: { title: "No at-risk learners", hint: "No learners flagged at risk this term." },
  };

  return (
    <section aria-label="Action required" className={styles.section}>
      {!isPending && !isError && allEmpty ? null : (
      <div className={styles.header}>
        <h2 className={styles.title}>Action required</h2>
        <p className={styles.description}>
          Follow-ups that need principal attention this term.
        </p>
      </div>
      )}
      {isPending ? (
        <div className={styles.actionGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className={styles.actionSkel} />
          ))}
        </div>
      ) : isError ? (
        <p className={styles.empty}>Could not load overview figures.</p>
      ) : (
        <>
          <div className={styles.actionGrid}>
            {actions.map((a) => {
              if (a.count === 0) {
                const copy = emptyCopy[a.key] ?? { title: "Nothing to review", hint: "No records this term." };
                return (
                  <PrincipalEmptyCard
                    key={a.key}
                    icon={a.icon}
                    title={copy.title}
                    hint={copy.hint}
                    label={copy.title}
                  />
                );
              }
              return (
                <AuroraBanner
                  key={a.key}
                  icon={a.icon}
                  pill={a.title}
                  count={a.count}
                  title={a.blurb}
                  cta={a.cta}
                  href={a.href}
                  label={`${a.title}: ${a.count} pending`}
                />
              );
            })}
            <AuroraBanner
              icon={ShieldAlert}
              pill="Grade spotlight"
              count={spotlight ? spotlight.count : 0}
              title={
                spotlight
                  ? `${spotlight.grade} carries the heaviest at-risk load`
                  : "No at-risk learners this term"
              }
              cta="View risk board"
              href="/principal/risk"
              label={
                spotlight
                  ? `Grade spotlight: ${spotlight.grade} has ${spotlight.count} at-risk students. View risk board.`
                  : "Grade spotlight: no at-risk learners this term. View risk board."
              }
            />
            <AuroraBanner
              icon={Award}
              pill="Honor Roll"
              count={honorCount}
              title={
                honorCount === 1 ? "Qualifier this term" : "Qualifiers this term"
              }
              cta="View honor roll"
              href="/principal/honor-roll"
              label={`Honor Roll: ${honorCount} qualifiers this term. View honor roll.`}
            />
          </div>
          {accountPending === 0 ? null : (
          <p className={styles.footnote}>
            <UserCog className={styles.footnoteIcon} aria-hidden />
            {accountPending} pending account approval
            {accountPending !== 1 ? "s" : ""} this term.
          </p>
          )}
        </>
      )}
    </section>
  );
}
