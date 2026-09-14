"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchGuidanceAdm } from "./components/guidance-adm-data";
import type { GuidanceAdmStageFilter } from "./components/guidance-adm-data";
import { GuidanceAdmTable } from "./components/guidance-adm-table";
import pageStyles from "../pages.module.css";
import styles from "./components/guidance-adm.module.css";

const PAGE_SIZE = 50;

export default function GuidanceAdmPage() {
  const [query, setQuery] = React.useState("");
  const [stage, setStage] = React.useState<GuidanceAdmStageFilter>("");
  const [page, setPage] = React.useState(1);
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  /* First client paint must match the server skeleton — cached query data
     would otherwise render live content over server skeleton HTML. */
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  React.useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setMounted(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const handleStageChange = (value: GuidanceAdmStageFilter) => {
    setStage(value);
    setPage(1);
  };

  const { data, isPending, isError, refetch, isRefetching, isFetching } =
    useQuery({
      queryKey: [
        "guidance-adm",
        { q: debouncedQuery, stage, page, pageSize: PAGE_SIZE },
      ],
      queryFn: () =>
        fetchGuidanceAdm({
          q: debouncedQuery || undefined,
          stage: stage || undefined,
          page,
          pageSize: PAGE_SIZE,
        }),
      staleTime: 60_000,
      placeholderData: keepPreviousData,
    });

  if (!mounted || isPending) {
    return (
      <section className={pageStyles.page} aria-busy="true">
        <div className={pageStyles.header}>
          <div>
            <p className={pageStyles.eyebrow}>Hand-off · ADM Coordinator</p>
            <h1 className={pageStyles.title}>ADM referrals</h1>
            <p className={pageStyles.lede}>
              Consult first, then hand off — adviser referrals waiting on your
              consultation, plus the live tracker of cases now with the ADM
              Coordinator.
            </p>
          </div>
        </div>

        {/* Top review-grid section skeleton — same position and shape as the
            3 review cards. */}
        <Card className={pageStyles.card}>
          <CardContent>
            <Skeleton style={{ width: "15rem", height: "1rem" }} />
            <Skeleton
              style={{ width: "24rem", maxWidth: "100%", height: "0.75rem", marginTop: "0.5rem" }}
            />
            <div className={styles.reviewGrid} aria-hidden="true" style={{ marginTop: "1rem" }}>
              {[0, 1, 2].map((i) => (
                <div key={i} className={styles.reviewCard}>
                  <Skeleton style={{ width: "55%", height: "0.875rem" }} />
                  <div className={styles.nestedCard}>
                    <Skeleton style={{ width: "40%", height: "0.75rem" }} />
                    <Skeleton style={{ width: "60%", height: "0.75rem", marginTop: "0.375rem" }} />
                    <Skeleton style={{ width: "75%", height: "0.75rem", marginTop: "0.375rem" }} />
                  </div>
                  <div className={styles.consultActions} style={{ justifyContent: "flex-end" }}>
                    <Skeleton style={{ width: "5.5rem", height: "1.5rem" }} />
                    <Skeleton style={{ width: "4rem", height: "1.5rem" }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className={styles.kpiGrid} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className={styles.kpiCard}>
              <Skeleton style={{ width: "60%", height: "0.75rem" }} />
              <Skeleton style={{ width: "30%", height: "1.5rem", marginTop: "0.5rem" }} />
            </Card>
          ))}
        </div>

        <div className={styles.toolbar} aria-hidden="true">
          <Skeleton style={{ width: "14rem", height: "1rem" }} />
          <Skeleton style={{ width: "20rem", maxWidth: "100%", height: "2rem" }} />
        </div>

        {/* Tracker table skeleton — same 5 columns as the live table. */}
        <div className={pageStyles.tableWrap} aria-hidden="true">
          <table className={pageStyles.table}>
            <thead>
              <tr>
                <th>Student</th>
                <th>Stage</th>
                <th>Status</th>
                <th>Next step</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2].map((i) => (
                <tr key={i}>
                  <td>
                    <div className={styles.nestedCard}>
                      <Skeleton style={{ width: "50%", height: "0.875rem" }} />
                      <Skeleton style={{ width: "80%", height: "0.75rem", marginTop: "0.375rem" }} />
                      <Skeleton style={{ width: "65%", height: "0.75rem", marginTop: "0.375rem" }} />
                    </div>
                  </td>
                  <td>
                    <Skeleton style={{ width: "6rem", height: "1.25rem", borderRadius: "999px" }} />
                    <Skeleton style={{ width: "8rem", height: "0.75rem", marginTop: "0.375rem" }} />
                  </td>
                  <td>
                    <Skeleton style={{ width: "5rem", height: "1.25rem", borderRadius: "999px" }} />
                    <Skeleton style={{ width: "7rem", height: "0.75rem", marginTop: "0.375rem" }} />
                  </td>
                  <td>
                    <Skeleton style={{ width: "7rem", height: "0.875rem" }} />
                    <Skeleton style={{ width: "9rem", height: "0.75rem", marginTop: "0.375rem" }} />
                  </td>
                  <td>
                    <div className={styles.badgeRow} style={{ justifyContent: "flex-end" }}>
                      <Skeleton style={{ width: "5.5rem", height: "1.5rem" }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={pageStyles.page}>
        <div className={pageStyles.header}>
          <div>
            <p className={pageStyles.eyebrow}>Hand-off · ADM Coordinator</p>
            <h1 className={pageStyles.title}>ADM referrals</h1>
          </div>
        </div>
        <div className={styles.errorBlock} role="alert">
          <p className={styles.errorText}>
            We couldn&apos;t load the ADM hand-offs. Please check your internet
            connection and try again.
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
      </section>
    );
  }

  return (
    <section className={pageStyles.page}>
      <div className={pageStyles.header}>
        <div>
          <p className={pageStyles.eyebrow}>Hand-off · ADM Coordinator</p>
          <h1 className={pageStyles.title}>ADM referrals</h1>
          <p className={pageStyles.lede}>
            Consult first, then hand off — adviser referrals waiting on your
            consultation, plus the live tracker of cases now with the ADM
            Coordinator.
          </p>
        </div>
      </div>

      <GuidanceAdmTable
        summary={data.summary}
        reviewQueue={data.reviewQueue}
        cases={data.cases}
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        totalPages={data.totalPages}
        onPageChange={setPage}
        query={query}
        onQueryChange={setQuery}
        stage={stage}
        onStageChange={handleStageChange}
        isNavigating={isFetching && !isPending}
      />
    </section>
  );
}
