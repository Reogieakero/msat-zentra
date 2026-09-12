"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth/useSession";
import { fetchGuidanceInterventions } from "./components/guidance-interventions-data";
import {
  GuidanceInterventionsTable,
} from "./components/guidance-interventions-table";
import type {
  FactorFilter,
  FollowUpStatusFilter,
  RiskLevelFilter,
} from "./components/guidance-interventions-data";
import pageStyles from "../pages.module.css";
import styles from "./components/guidance-interventions.module.css";

const PAGE_SIZE = 12;

export default function GuidanceInterventionsPage() {
  const session = useSession();
  const [query, setQuery] = React.useState("");
  const [level, setLevel] = React.useState<RiskLevelFilter>("High");
  const [factor, setFactor] = React.useState<FactorFilter>("");
  const [outcome, setOutcome] = React.useState<FollowUpStatusFilter>("");
  const [mineOnly, setMineOnly] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [debouncedQuery, setDebouncedQuery] = React.useState("");

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const resetPage = () => setPage(1);

  const { data, isPending, isError, refetch, isRefetching, isFetching } =
    useQuery({
      queryKey: [
        "guidance-interventions",
        { q: debouncedQuery, level, factor, outcome, mineOnly, page, pageSize: PAGE_SIZE },
      ],
      queryFn: () =>
        fetchGuidanceInterventions({
          q: debouncedQuery || undefined,
          level,
          factor: factor || undefined,
          outcome: outcome || undefined,
          mine: mineOnly || undefined,
          page,
          pageSize: PAGE_SIZE,
        }),
    });

  return (
    <section className={pageStyles.page}>
      <div className={pageStyles.header}>
        <div>
          <h1 className={pageStyles.title}>Interventions</h1>
          <p className={pageStyles.lede}>
            Live high-risk students from the at-risk engine — start follow-ups,
            review the plan, and record how each student recovers.
          </p>
        </div>
      </div>

      <Card className={pageStyles.card}>
        <CardHeader>
          <CardTitle className={pageStyles.sectionTitle}>
            High-risk students right now
          </CardTitle>
          <CardDescription className={pageStyles.sectionDesc}>
            {data
              ? `${data.total} student${data.total === 1 ? "" : "s"} · recomputed live from grades, attendance, and behavior filings.`
              : "Live at-risk students from the engine."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div aria-busy="true" className={styles.feed}>
              <div className={styles.skelToolbar}>
                <Skeleton className={styles.skelCount} />
                <div className={styles.skelFilters}>
                  <Skeleton className={styles.skelSearch} />
                  <Skeleton className={styles.skelDrop} />
                  <Skeleton className={styles.skelDrop} />
                  <Skeleton className={styles.skelDrop} />
                  <Skeleton className={styles.skelToggle} />
                </div>
              </div>
              <div className={styles.skelTableWrap}>
                <div className={styles.skelTable}>
                  <div className={styles.skelHeadRow}>
                    {[0, 1, 2, 3].map((i) => (
                      <Skeleton key={i} className={styles.skelTh} />
                    ))}
                  </div>
                  {[0, 1, 2, 3, 4].map((row) => (
                    <div key={row} className={styles.skelRow}>
                      <div className={styles.skelCell}>
                        <Skeleton
                          className={styles.skelBar}
                          style={{ width: "70%" }}
                        />
                        <Skeleton
                          className={styles.skelBar}
                          style={{ width: "45%" }}
                        />
                      </div>
                      <div className={styles.skelCell}>
                        <Skeleton
                          className={styles.skelPill}
                          style={{ width: "4.5rem" }}
                        />
                        <Skeleton
                          className={styles.skelBar}
                          style={{ width: "55%" }}
                        />
                        <Skeleton
                          className={styles.skelBar}
                          style={{ width: "40%" }}
                        />
                      </div>
                      <div className={styles.skelCell}>
                        <Skeleton
                          className={styles.skelBar}
                          style={{ width: "85%" }}
                        />
                        <div className={styles.skelBtnRow}>
                          <Skeleton
                            className={styles.skelPill}
                            style={{ width: "5rem" }}
                          />
                          <Skeleton
                            className={styles.skelPill}
                            style={{ width: "4rem" }}
                          />
                        </div>
                        <Skeleton
                          className={styles.skelBar}
                          style={{ width: "60%" }}
                        />
                      </div>
                      <div className={styles.skelCell}>
                        <div className={styles.skelBtnRow}>
                          <Skeleton
                            className={styles.skelBtn}
                            style={{ width: "5rem" }}
                          />
                          <Skeleton
                            className={styles.skelBtn}
                            style={{ width: "4rem" }}
                          />
                        </div>
                        <div className={styles.skelBtnRow}>
                          <Skeleton
                            className={styles.skelBtn}
                            style={{ width: "6.5rem" }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.skelPager}>
                <Skeleton className={styles.skelRange} />
                <div className={styles.skelPagerBtns}>
                  <Skeleton className={styles.skelPageBtn} />
                  <Skeleton className={styles.skelPageLabel} />
                  <Skeleton className={styles.skelPageBtn} />
                </div>
              </div>
            </div>
          ) : isError || !data ? (
            <div className={styles.empty} role="alert">
              <p className={styles.emptyTitle}>We couldn&apos;t load the queue</p>
              <p className={styles.emptyHint}>
                Please check your internet connection and try again.
              </p>
              <Button
                size="sm"
                variant="outline"
                disabled={isRefetching}
                onClick={() => refetch()}
              >
                {isRefetching ? (
                  <Loader2 className={styles.spin} aria-hidden="true" />
                ) : null}
                {isRefetching ? "Loading…" : "Try again"}
              </Button>
            </div>
          ) : (
            <GuidanceInterventionsTable
              summary={data.summary}
              students={data.students}
              level={level}
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={setPage}
              query={query}
              onQueryChange={setQuery}
              onLevelChange={(v) => {
                setLevel(v);
                resetPage();
              }}
              factor={factor}
              onFactorChange={(v) => {
                setFactor(v);
                resetPage();
              }}
              outcome={outcome}
              onOutcomeChange={(v) => {
                setOutcome(v);
                resetPage();
              }}
              mineOnly={mineOnly}
              onMineOnlyChange={(v) => {
                setMineOnly(v);
                resetPage();
              }}
              myUserId={session?.sub ?? null}
              onRetry={() => refetch()}
              isRetrying={isRefetching}
              isNavigating={isFetching && !isPending}
            />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
