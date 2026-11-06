"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { PrincipalEmptyCard } from "../components/PrincipalEmptyCard";
import { CandidateTable } from "./components/CandidateTable";
import {
  deriveHonorRoll,
  fetchLiveHonorRoll,
} from "@/services/principal/honorRoll.service";
import {
  HONOR_ROLL_GRADES,
  type HonorRollCandidate,
} from "@/services/principal/honorRoll.types";
import { useTerm } from "@/lib/term/TermContext";
import styles from "./honor-roll.module.css";

export default function PrincipalHonorRollPage() {
  const [grade, setGrade] = React.useState<string>("7");

  const { activeTerm, termReady } = useTerm();
  const termId = activeTerm?.termId ?? null;
  const {
    data: summary,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ["academic-insights", "honor-roll-live", termId],
    queryFn: fetchLiveHonorRoll,
    // Live board: the service recomputes averages from raw scores and the route
    // cache is 15s, so poll at 30s and refresh on tab focus.
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    enabled: termReady,
  });

  const loading = isPending || !termReady;
  const derived = React.useMemo(
    () => (summary ? deriveHonorRoll(summary) : null),
    [summary]
  );

  const filtered = React.useMemo(() => {
    const all: HonorRollCandidate[] = derived?.candidates ?? [];
    if (grade === "all") return all;
    return all.filter((c) => c.gradeLevel === Number(grade));
  }, [derived, grade]);

  const handleGradeChange = (value: string) => setGrade(value);

  if (isError) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    return (
      <section className={styles.page}>
        <div className={styles.error}>
          {status
            ? `Failed to load honor roll (HTTP ${status})`
            : "Failed to load honor roll"}
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className={styles.page} aria-label="Loading honor roll" aria-busy="true">
        <div className={styles.skeletonBar} />
        <div className={styles.skeletonTable} />
      </section>
    );
  }

  const isEmpty = !loading && (derived?.candidates ?? []).length === 0;
  if (isEmpty) {
    return (
      <section className={styles.page}>
        <PrincipalEmptyCard
          icon={Trophy}
          title="No awardees this term"
          hint="Students from adviser-shared sections with a live general average of 90+ and no subject below 80 will appear here as scores are recorded."
          label="Honor Roll & Awards"
          centered
        />
      </section>
    );
  }
  return (
    <section className={styles.page}>
      <CandidateTable
        candidates={filtered}
        grades={HONOR_ROLL_GRADES}
        activeGrade={grade}
        onGradeChange={handleGradeChange}
        schoolYear={derived?.schoolYear}
        termLabel={derived?.termLabel}
      />
    </section>
  );
}
