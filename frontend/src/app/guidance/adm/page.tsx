"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchGuidanceAdm } from "./components/guidance-adm-data";
import { GuidanceAdmReports } from "./components/guidance-adm-reports";
import { GuidanceAdmTable } from "./components/guidance-adm-table";
import pageStyles from "../pages.module.css";
import styles from "./components/guidance-adm.module.css";

export default function GuidanceAdmPage() {
  const { data, isPending, isError, refetch, isRefetching } = useQuery({
    queryKey: ["guidance-adm"],
    queryFn: () => fetchGuidanceAdm({ page: 1, pageSize: 1 }),
    staleTime: 60_000,
  });

  if (isPending) {
    return (
      <section className={pageStyles.page} aria-busy="true">
        <div
          aria-hidden="true"
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(17rem, 1fr))", gap: "1rem" }}
        >
          <Card>
            <CardContent>
              <Skeleton style={{ width: "45%", height: "0.9375rem" }} />
              <Skeleton style={{ width: "75%", height: "0.8125rem", marginTop: "0.125rem" }} />
              <Skeleton style={{ width: "100%", height: "168px", marginTop: "0.75rem" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginTop: "0.5rem" }}>
                {[0, 1, 2, 3, 4].map((j) => (
                  <div key={j} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <Skeleton style={{ width: "6rem", height: "0.8125rem" }} />
                    <Skeleton style={{ width: "2rem", height: "0.8125rem" }} />
                  </div>
                ))}
              </div>
              <Skeleton style={{ width: "100%", height: "2.25rem", marginTop: "0.625rem", paddingLeft: "0.625rem" }} />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Skeleton style={{ width: "45%", height: "0.9375rem" }} />
              <Skeleton style={{ width: "75%", height: "0.8125rem", marginTop: "0.125rem" }} />
              {/* Trend chart is 200px with axes, not 168px like the donut. */}
              <Skeleton style={{ width: "100%", height: "200px", marginTop: "0.75rem" }} />
              <Skeleton style={{ width: "100%", height: "2.25rem", marginTop: "0.625rem", paddingLeft: "0.625rem" }} />
            </CardContent>
          </Card>
        </div>

        {/* Queue card skeleton — mirrors the live Card: header row with
            title/desc + 16rem × 2rem search, then the 8-column table with
            roomy 0.875rem/1rem cells, 2-line LRN cell, badge pills, and
            action icons. */}
        <Card aria-hidden="true">
          <CardContent>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", flex: "1 1 auto", minWidth: 0 }}>
                <Skeleton style={{ width: "12rem", height: "0.9375rem" }} />
                <Skeleton style={{ width: "min(24rem, 90%)", height: "0.8125rem" }} />
              </div>
              <Skeleton style={{ width: "16rem", height: "2rem" }} />
            </div>
            <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", marginTop: "0.75rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "36rem" }}>
                <thead>
                  <tr>
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <th key={i} style={{ padding: "0.875rem 1rem" }}>
                        <Skeleton style={{ width: "4rem", height: "0.75rem" }} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2].map((i) => (
                    <tr key={i}>
                      <td style={{ padding: "0.875rem 1rem" }}>
                        <Skeleton style={{ width: "5rem", height: "0.8125rem" }} />
                        <Skeleton style={{ width: "7rem", height: "0.75rem", marginTop: "0.125rem" }} />
                      </td>
                      <td style={{ padding: "0.875rem 1rem" }}>
                        <Skeleton style={{ width: "3.5rem", height: "1.375rem", borderRadius: "9999px" }} />
                      </td>
                      <td style={{ padding: "0.875rem 1rem" }}>
                        <Skeleton style={{ width: "5rem", height: "1.375rem", borderRadius: "9999px" }} />
                      </td>
                      <td style={{ padding: "0.875rem 1rem" }}>
                        <Skeleton style={{ width: "4rem", height: "1.375rem", borderRadius: "9999px" }} />
                      </td>
                      <td style={{ padding: "0.875rem 1rem" }}>
                        <Skeleton style={{ width: "6rem", height: "0.8125rem" }} />
                      </td>
                      <td style={{ padding: "0.875rem 1rem" }}>
                        <Skeleton style={{ width: "3.5rem", height: "0.8125rem" }} />
                      </td>
                      <td style={{ padding: "0.875rem 1rem" }}>
                        <Skeleton style={{ width: "5rem", height: "0.8125rem" }} />
                      </td>
                      <td style={{ padding: "0.875rem 1rem" }}>
                        <Skeleton style={{ width: "1.5rem", height: "1.5rem" }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={pageStyles.page}>
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
      <GuidanceAdmReports summary={data.summary} />

      <GuidanceAdmTable
        summary={data.summary}
        reviewQueue={data.reviewQueue}
      />
    </section>
  );
}
