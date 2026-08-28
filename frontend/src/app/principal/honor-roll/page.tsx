"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Download, Trophy, X } from "lucide-react";
import { HonorRollHero } from "./components/HonorRollHero";
import { TierLeaderboard } from "./components/TierLeaderboard";
import { CandidateTable } from "./components/CandidateTable";
import { AwardCategories } from "./components/AwardCategories";
import {
  deriveHonorRoll,
  AWARD_CATEGORIES,
  HONOR_ROLL_GRADES,
  type AwardCategory,
  type HonorRollCandidate,
} from "./honor-roll-data";
import { apiClient } from "@/lib/api/client";
import type { AcademicsMock } from "../academics/academics-data";
import styles from "./honor-roll.module.css";

export default function PrincipalHonorRollPage() {
  const [grade, setGrade] = React.useState<string>("7");
  const [rankOpen, setRankOpen] = React.useState(false);
  const [activeAward, setActiveAward] = React.useState<AwardCategory | null>(null);

  const [summary, setSummary] = React.useState<AcademicsMock | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .get<AcademicsMock>("/api/academics", { params: { mode: "final" } })
      .then((res) => {
        if (!cancelled) setSummary(res.data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          setError(
            status
              ? `Failed to load honor roll (HTTP ${status})`
              : "Failed to load honor roll"
          );
          console.error("[/api/academics] fetch failed:", err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = !summary && !error;
  const derived = React.useMemo(
    () => (summary ? deriveHonorRoll(summary) : null),
    [summary]
  );

  const termLabel = derived?.termLabel ?? "";

  const filtered = React.useMemo(() => {
    const all: HonorRollCandidate[] = derived?.candidates ?? [];
    return all.filter((c) => c.gradeLevel === Number(grade));
  }, [derived, grade]);

  const highestCount = filtered.filter((c) => c.tier === "Highest Honors").length;

  const handleGradeChange = (value: string) => setGrade(value);

  const handleExport = () => {
    console.info("[honor-roll] export — candidates:", filtered.length);
  };

  if (error) {
    return (
      <section className={styles.page}>
        <div className={styles.error}>{error}</div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className={styles.page}>
        <div className={styles.skeletonHero} />
        <div className={styles.skeletonBar} />
        <div className={styles.skeletonTable} />
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <HonorRollHero
        data={{
          termLabel,
          schoolYear: "Active Term",
          awards: AWARD_CATEGORIES,
        }}
        candidateCount={filtered.length}
        highestCount={highestCount}
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

        <div className={styles.toolbarRight}>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-3.5" /> Export
          </Button>
        </div>
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

      <AwardCategories awards={AWARD_CATEGORIES} onSelect={setActiveAward} />

      <Sheet open={activeAward !== null} onOpenChange={(o) => !o && setActiveAward(null)}>
        <SheetContent side="right" className={styles.awardSheet}>
          {activeAward ? (
            <>
              <SheetHeader>
                <SheetTitle>{activeAward.title}</SheetTitle>
                <SheetDescription>{activeAward.description}</SheetDescription>
              </SheetHeader>
              <div className={styles.awardSheetBody}>
                <p className={styles.awardSheetBasis}>Basis: {activeAward.basis}</p>
                <p className={styles.awardSheetNote}>
                  Recipients for this term will be listed here once finalized.
                </p>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}
