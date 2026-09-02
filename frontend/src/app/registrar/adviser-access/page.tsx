"use client";

import * as React from "react";
import { ShieldQuestion } from "lucide-react";
import {
  AdviserAccessGrid,
  AdviserAccessGridSkeleton,
} from "./components/AdviserAccessGrid";
import { AdviseePanel } from "./components/AdviseePanel";
import { AdviserAccessHeader } from "./components/AdviserAccessHeader";
import { apiClient } from "@/lib/api/client";
import type { AdviserAccessRequest, AccessRequestStatus } from "./components/types";
import styles from "./adviser-access.module.css";

type RequestsResponse = { requests: AdviserAccessRequest[] };

const SECTIONS: { status: AccessRequestStatus; title: string; description: string }[] = [
  {
    status: "pending",
    title: "Pending",
    description: "Awaiting your decision.",
  },
  {
    status: "approved",
    title: "Approved",
    description: "SF10 read access granted.",
  },
  {
    status: "denied",
    title: "Denied",
    description: "SF10 read access not granted.",
  },
];

export default function AdviserAccessPage() {
  const [requests, setRequests] = React.useState<AdviserAccessRequest[]>([]);
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

  const grouped = React.useMemo(() => {
    const g: Record<AccessRequestStatus, AdviserAccessRequest[]> = {
      pending: [],
      approved: [],
      denied: [],
    };
    requests.forEach((r) => g[r.status].push(r));
    return g;
  }, [requests]);

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

  if (error) {
    return (
      <section className={styles.page}>
        <AdviserAccessHeader />
        <p className={styles.error}>{error}</p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className={styles.page}>
        <AdviserAccessHeader />
        <AdviserAccessGridSkeleton />
      </section>
    );
  }

  if (requests.length === 0) {
    return (
      <section className={styles.page}>
        <AdviserAccessHeader />
        <div className={styles.empty}>
          <ShieldQuestion className={styles.emptyIcon} />
          <p className={styles.emptyText}>No adviser access requests for grades 11–12.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <AdviserAccessHeader />

      <div className={styles.layout} data-selected={selectedId ? "true" : "false"}>
        <div className={styles.listCol}>
          <div className={styles.sections}>
            {SECTIONS.map((section) => {
              const items = grouped[section.status];
              return (
                <section key={section.status} className={styles.sectionBlock}>
                  <header className={styles.sectionHeader}>
                    <div>
                      <h2 className={styles.sectionTitle}>{section.title}</h2>
                      <p className={styles.sectionDesc}>{section.description}</p>
                    </div>
                    <span
                      className={styles.sectionCount}
                      data-status={section.status}
                    >
                      {items.length}
                    </span>
                  </header>

                  {items.length === 0 ? (
                    <div className={styles.sectionEmpty}>
                      <p>Nothing here.</p>
                    </div>
                  ) : (
                    <AdviserAccessGrid
                      requests={items}
                      actingId={acting}
                      onViewAdvisees={(id) => setSelectedId(id)}
                      onActed={handleActed}
                    />
                  )}
                </section>
              );
            })}
          </div>
        </div>

        <aside className={styles.sidebar}>
          <AdviseePanel
            request={requests.find((r) => r.id === selectedId) ?? null}
            onClose={() => setSelectedId(null)}
          />
        </aside>
      </div>
    </section>
  );
}
