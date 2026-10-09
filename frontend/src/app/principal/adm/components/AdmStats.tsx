"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAdmDashboard } from "@/services/principal/adm.service";
import { useTerm } from "@/lib/term/TermContext";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./AdmStats.module.css";

const STATS = [
  {
    key: "pendingSignature",
    label: "Pending Signature",
    description: "Cases awaiting your review and signature to proceed.",
  },
  {
    key: "signed",
    label: "Signed This Term",
    description: "Profiles you've approved and authorized for release.",
  },
  {
    key: "active",
    label: "Active Profiles",
    description: "Learners currently progressing through the ADM pipeline.",
  },
  {
    key: "total",
    label: "Total Referred",
    description: "All referrals filed since the start of the school year.",
  },
] as const;

export function AdmStats() {
  const { termReady } = useTerm();
  const { data, isPending } = useQuery({
    queryKey: ["adm-dashboard"],
    queryFn: ({ signal }) => fetchAdmDashboard(signal),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: termReady,
  });

  const getStatValue = (key: string) => {
    if (isPending) return "—";
    if (!data) return "0";
    if (key === "total") {
      return data.stageBreakdown.reduce((sum, s) => sum + s.count, 0);
    }
    return data.kpis[key as keyof typeof data.kpis] ?? 0;
  };

  return (
    <section className={styles.section} aria-busy={isPending || undefined}>
      <div className={styles.grid}>
        {STATS.map((stat) => (
          <div key={stat.key} className={styles.stat}>
            <span className={styles.glowClip} aria-hidden="true">
              <span className={styles.cardGlow} />
            </span>
            {isPending ? (
              <>
                <Skeleton className="h-8 w-16" aria-hidden="true" />
                <Skeleton className="h-4 w-24" aria-hidden="true" />
                <Skeleton className="h-3 w-full" aria-hidden="true" />
              </>
            ) : (
              <>
            <span className={styles.value}>{getStatValue(stat.key)}</span>
            <span className={styles.label}>{stat.label}</span>
            <p className={styles.description}>{stat.description}</p>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
