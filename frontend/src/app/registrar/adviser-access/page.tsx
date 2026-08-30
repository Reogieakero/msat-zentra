"use client";

import * as React from "react";
import { ShieldQuestion } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RequestCard } from "./components/RequestCard";
import { AdviseePanel } from "./components/AdviseePanel";
import { apiClient } from "@/lib/api/client";
import type { AdviserAccessRequest, AccessRequestStatus } from "./components/types";
import styles from "./adviser-access.module.css";

type Filter = "pending" | "approved" | "denied" | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
  { value: "all", label: "All" },
];

type RequestsResponse = { requests: AdviserAccessRequest[] };

export default function AdviserAccessPage() {
  const [requests, setRequests] = React.useState<AdviserAccessRequest[]>([]);
  const [filter, setFilter] = React.useState<Filter>("pending");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [acting, setActing] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .get<RequestsResponse>("/api/registrar/adviser-access-requests")
      .then((res) => {
        if (!cancelled) setRequests(res.data.requests);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        setError(
          status
            ? `Failed to load access requests (HTTP ${status})`
            : "Failed to load access requests",
        );
        console.error("[/api/registrar/adviser-access-requests] fetch failed:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient
      .get<RequestsResponse>("/api/registrar/adviser-access-requests")
      .then((res) => setRequests(res.data.requests))
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        setError(
          status
            ? `Failed to load access requests (HTTP ${status})`
            : "Failed to load access requests",
        );
        console.error("[/api/registrar/adviser-access-requests] fetch failed:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const counts = React.useMemo(() => {
    const c: Record<AccessRequestStatus, number> = { pending: 0, approved: 0, denied: 0 };
    requests.forEach((r) => (c[r.status] += 1));
    return c;
  }, [requests]);

  const visible = React.useMemo(() => {
    if (filter === "all") return requests;
    return requests.filter((r) => r.status === filter);
  }, [requests, filter]);

  const handleActed = React.useCallback(
    (id: string, approved: boolean, reason?: string) => {
      setActing(id);
      const endpoint = approved ? "approve" : "deny";
      apiClient
        .post(`/api/registrar/adviser-access-requests/${id}/${endpoint}`, approved ? {} : { reason: reason ?? "Denied by registrar" })
        .then(() => load())
        .catch((err: unknown) => {
          console.error(`[/api/registrar/adviser-access-requests/${id}/${endpoint}] failed:`, err);
        })
        .finally(() => setActing(null));
    },
    [load],
  );

  return (
    <section className={styles.page}>
      <header className={styles.head}>
        <div className={styles.titleRow}>
          <span className={styles.titleIcon}>
            <ShieldQuestion className={styles.titleIconSvg} />
          </span>
          <div>
            <h1 className={styles.title}>Adviser SF10 Access Requests</h1>
            <p className={styles.subtitle}>
              Review and decide Grade 11–12 adviser requests for SF10 read access.
            </p>
          </div>
        </div>

        {!loading && !error ? (
          <div className={styles.stats}>
            <Stat label="Pending" value={counts.pending} tone="warning" />
            <Stat label="Approved" value={counts.approved} tone="ok" />
            <Stat label="Denied" value={counts.denied} tone="bad" />
          </div>
        ) : null}
      </header>

      {error ? (
        <p className={styles.error}>{error}</p>
      ) : (
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className={styles.tabs}>
          <TabsList className={styles.tabsList} aria-label="Filter requests">
            {FILTERS.map((f) => {
              const tabCount =
                f.value === "all"
                  ? requests.length
                  : counts[f.value as AccessRequestStatus];
              return (
                <TabsTrigger key={f.value} value={f.value} className={styles.tabTrigger}>
                  {f.label}
                  <span className={styles.tabCount}>{tabCount}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value={filter} className={styles.tabsContent}>
            <div className={styles.layout} data-selected={selectedId ? "true" : "false"}>
              <div className={styles.listCol}>
                {loading ? (
                  <div className={styles.grid}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className={styles.skelCard} />
                    ))}
                  </div>
                ) : visible.length === 0 ? (
                  <div className={styles.empty}>
                    <ShieldQuestion className={styles.emptyIcon} />
                    <p className={styles.emptyText}>No {filter} requests for grades 11–12.</p>
                  </div>
                ) : (
                  <div className={styles.grid}>
                    {visible.map((r) => (
                      <RequestCard
                        key={r.id}
                        request={r}
                        acting={acting === r.id}
                        selected={selectedId === r.id}
                        onViewAdvisees={() => setSelectedId(r.id)}
                        onActed={handleActed}
                      />
                    ))}
                  </div>
                )}
              </div>

              <aside className={styles.sidebar}>
                <AdviseePanel
                  request={requests.find((r) => r.id === selectedId) ?? null}
                  onClose={() => setSelectedId(null)}
                />
              </aside>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "warning" | "ok" | "bad";
}) {
  return (
    <div className={`${styles.stat} ${styles[`stat_${tone}`]}`}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
