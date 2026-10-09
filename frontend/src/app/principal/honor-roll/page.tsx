"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Download, Trophy, X } from "lucide-react";
import { HonorRollHero } from "./components/HonorRollHero";
import { PrincipalPageHeader } from "../components/PrincipalPageHeader";
import { PrincipalEmptyCard } from "../components/PrincipalEmptyCard";
import { TierLeaderboard } from "./components/TierLeaderboard";
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
import { PageHeaderSkeleton } from "../components/skeletons/PageHeaderSkeleton";
import styles from "./honor-roll.module.css";

export default function PrincipalHonorRollPage() {
  const [grade, setGrade] = React.useState<string>("7");
  const [rankOpen, setRankOpen] = React.useState(false);

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
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: termReady,
  });

  const loading = isPending || !termReady;
  const derived = React.useMemo(
    () => (summary ? deriveHonorRoll(summary) : null),
    [summary]
  );

  const filtered = React.useMemo(() => {
    const all: HonorRollCandidate[] = derived?.candidates ?? [];
    return all.filter((c) => c.gradeLevel === Number(grade));
  }, [derived, grade]);

  const awardedCount = filtered.length;

  const handleGradeChange = (value: string) => setGrade(value);

  const handleExport = () => {
    if (filtered.length === 0) return;
    const header = ["Rank", "Name", "LRN", "Section", "General Avg", "Band"];
    const rows = filtered
      .slice()
      .sort((a, b) => b.overallAverage - a.overallAverage)
      .map((c, i) => [
        String(i + 1),
        c.name,
        c.lrn,
        c.section,
        c.overallAverage.toFixed(1),
        c.band,
      ]);
    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `honor-roll-grade-${grade}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
        <PageHeaderSkeleton withActions />
        <div className={styles.skeletonHero} />
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
          hint="Students with a live general average of 90+ and no subject below 80 will appear here as scores are recorded."
          label="Honor Roll & Awards"
          centered
        />
      </section>
    );
  }
  return (
    <section className={styles.page}>
      <PrincipalPageHeader
        title="Honor Roll & Awards"
        description="DO 15, s. 2026 Academic Excellence — live general average ≥ 90, no subject below 80."
        actions={
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-3.5" /> Export
          </Button>
        }
      />
      <HonorRollHero
        data={{
          schoolYear: derived?.schoolYear ?? "",
        }}
        candidateCount={awardedCount}
      />

      <div className={styles.toolbar}>
        <Button
          variant={rankOpen ? "default" : "outline"}
          size="sm"
          onClick={() => setRankOpen((v) => !v)}
          aria-pressed={rankOpen}
        >
          <Trophy className="size-3.5" /> See top students rank
        </Button>
      </div>

      <CandidateTable
        candidates={filtered}
        grades={HONOR_ROLL_GRADES}
        activeGrade={grade}
        onGradeChange={handleGradeChange}
      />

      {rankOpen ? (
        <div className={styles.rankFloat}>
          <div className={styles.rankFloatHead}>
            <span className={styles.rankFloatTitle}>Top of the Term</span>
            <button
              type="button"
              className={styles.rankFloatClose}
              onClick={() => setRankOpen(false)}
              aria-label="Close"
            >
              <X className={styles.rankFloatCloseIcon} />
            </button>
          </div>
          <TierLeaderboard candidates={filtered} />
        </div>
      ) : null}

    </section>
  );
}
