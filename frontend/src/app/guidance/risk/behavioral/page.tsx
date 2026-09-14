"use client";

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchGuidanceAnecdotal,
} from "../../anecdotal/components/guidance-anecdotal-data";
import {
  GuidanceBehavioralFilters,
  type BehavioralCategoryFilter,
} from "./components/guidance-behavioral-filters";
import { GuidanceBehavioralCards } from "./components/guidance-behavioral-cards";
import { GuidanceCategoryDonut } from "./components/guidance-category-donut";
import filterStyles from "./components/guidance-behavioral-filters.module.css";
import donutStyles from "./components/guidance-category-donut.module.css";
import cardsStyles from "./components/guidance-behavioral-cards.module.css";
import styles from "../../pages.module.css";

const PAGE_SIZE = 50;

/**
 * Guidance behavioral records — fully live. Lists only filings an adviser
 * explicitly referred to guidance (`/api/guidance/anecdotal`): category
 * flags and counts that feed the behavioral risk flag (≥ 1 report).
 * Students and parents later see the level + category only, never the
 * write-up — and that write-up never leaves the case file here either.
 */
export default function GuidanceBehavioralPage() {
  const [queryInput, setQueryInput] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<BehavioralCategoryFilter>("all");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(queryInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [queryInput]);

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ["guidance-risk-behavioral", query, category, page],
    queryFn: () =>
      fetchGuidanceAnecdotal({
        q: query,
        category: category === "all" ? "" : category,
        page,
        pageSize: PAGE_SIZE,
      }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true">
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Insights · Behavioral</p>
            <h1 className={styles.title}>Behavioral records</h1>
            <p className={styles.lede}>Loading referred filings…</p>
          </div>
          <Skeleton style={{ width: "8rem", height: "1.5rem" }} />
        </div>

        {/* Donut card mirror — chart + legend + interpretation. */}
        <Card className={styles.card} aria-hidden="true">
          <CardHeader>
            <CardTitle className={styles.sectionTitle}>
              <Skeleton style={{ width: "14rem", height: "1rem" }} />
            </CardTitle>
            <CardDescription className={styles.sectionDesc}>
              <Skeleton style={{ width: "22rem", maxWidth: "100%", height: "0.8rem" }} />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={donutStyles.chartRow}>
              <Skeleton style={{ width: "13rem", height: "10.5rem", borderRadius: "50%" }} />
              <div style={{ flex: "1 1 12rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} style={{ width: `${88 - i * 9}%`, height: "0.9rem" }} />
                ))}
              </div>
            </div>
            <Skeleton style={{ width: "100%", height: "3rem", marginTop: "0.875rem" }} />
          </CardContent>
        </Card>

        {/* Feed card mirror — header action, filter row, cards grid, pager. */}
        <Card className={styles.card} aria-hidden="true">
          <CardHeader>
            <CardTitle className={styles.sectionTitle}>
              <Skeleton style={{ width: "12rem", height: "1rem" }} />
            </CardTitle>
            <CardDescription className={styles.sectionDesc}>
              <Skeleton style={{ width: "18rem", maxWidth: "100%", height: "0.8rem" }} />
            </CardDescription>
            <CardAction className={filterStyles.headerAction}>
              <div className={filterStyles.filters} style={{ marginBottom: 0 }}>
                <Skeleton style={{ width: "22rem", maxWidth: "100%", height: "2rem" }} />
                <Skeleton style={{ width: "7rem", height: "2rem" }} />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ul className={cardsStyles.grid}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <li key={i} className={cardsStyles.card}>
                  <div className={cardsStyles.top}>
                    <div style={{ flex: 1 }}>
                      <Skeleton style={{ width: "60%", height: "0.9rem" }} />
                      <Skeleton style={{ width: "40%", height: "0.75rem", marginTop: "0.375rem" }} />
                    </div>
                    <Skeleton style={{ width: "4.5rem", height: "1.25rem" }} />
                  </div>
                  <div className={cardsStyles.meta}>
                    {[0, 1, 2, 3, 4, 5].map((j) => (
                      <div key={j} className={cardsStyles.metaItem}>
                        <Skeleton style={{ width: "45%", height: "0.65rem" }} />
                        <Skeleton style={{ width: "80%", height: "0.8rem", marginTop: "0.375rem" }} />
                      </div>
                    ))}
                  </div>
                  <div className={cardsStyles.foot}>
                    <Skeleton style={{ width: "6rem", height: "1.25rem" }} />
                    <span className={cardsStyles.spacer} />
                    <Skeleton style={{ width: "5.5rem", height: "1.5rem" }} />
                  </div>
                </li>
              ))}
            </ul>
            <div className={styles.actionsRight} style={{ marginTop: "0.75rem" }}>
              <Skeleton style={{ width: "4rem", height: "1.75rem" }} />
              <Skeleton style={{ width: "7rem", height: "0.8rem" }} />
              <Skeleton style={{ width: "4rem", height: "1.75rem" }} />
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.page}>
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Insights · Behavioral</p>
            <h1 className={styles.title}>Behavioral records</h1>
          </div>
        </div>
        <Card className={styles.card}>
          <CardHeader>
            <CardTitle className={styles.sectionTitle}>
              We couldn&apos;t load the behavioral feed
            </CardTitle>
            <CardDescription className={styles.sectionDesc}>
              Check your connection and try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? "Retrying…" : "Retry"}
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  const from = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const to = Math.min(data.page * data.pageSize, data.total);

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Insights · Behavioral</p>
          <h1 className={styles.title}>Behavioral records</h1>
          <p className={styles.lede}>
            Live category flags and counts from filings referred to guidance —
            the signal behind the behavioral risk flag (≥ 1 report).
          </p>
        </div>
        <Badge variant="outline">Live · {data.total} referred</Badge>
      </div>

      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.sectionTitle}>
            Referred filings by category
          </CardTitle>
          <CardDescription className={styles.sectionDesc}>
            Only records an adviser routed to guidance — unreferred filings
            never appear here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GuidanceCategoryDonut summary={data.summary} />
        </CardContent>
      </Card>

      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.sectionTitle}>
            Behavioral signal feed
          </CardTitle>
          <CardDescription className={styles.sectionDesc}>
            Category + tier rows, no clinical text. Showing {from}–{to} of{" "}
            {data.total}.
          </CardDescription>
          <CardAction className={filterStyles.headerAction}>
            <GuidanceBehavioralFilters
              query={queryInput}
              onQueryChange={(v) => setQueryInput(v)}
              category={category}
              onCategoryChange={(v) => {
                setCategory(v);
                setPage(1);
              }}
              summary={data.summary}
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          {data.records.length === 0 ? (
            <p className={styles.sectionDesc}>
              No referred filings match — try clearing the search or filter.
            </p>
          ) : (
            <GuidanceBehavioralCards records={data.records} />
          )}

          <div className={styles.actionsRight} style={{ marginTop: "0.75rem" }}>
            <Button
              size="sm"
              variant="outline"
              disabled={data.page <= 1 || (isFetching && !isPending)}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className={styles.sectionDesc} aria-live="polite">
              {isFetching && !isPending
                ? "Loading…"
                : `Page ${data.page} of ${data.totalPages}`}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={data.page >= data.totalPages || (isFetching && !isPending)}
              onClick={() =>
                setPage((p) => Math.min(data.totalPages, p + 1))
              }
            >
              Next
            </Button>
          </div>

          <div className={styles.actions} style={{ marginTop: "0.75rem" }}>
            <Button size="sm" variant="outline" asChild>
              <Link href="/guidance/alerts">Open at-risk queue</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/guidance/referrals">View referrals</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className={styles.note}>
        Guidance sees owning + referred rows; the full write-up opens only
        through the case file, never from this feed.
      </p>
    </section>
  );
}
