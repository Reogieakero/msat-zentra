"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMyRecords } from "@/components/ocform01/folders";
import { AnecdotalRepoSidebar } from "./components/AnecdotalRepoSidebar";
import { AnecdotalRepoFolders } from "./components/AnecdotalRepoFolders";
import styles from "./components/anecdotal-repo.module.css";

/**
 * Teacher anecdotal repository: every anecdotal record the adviser filed,
 * with the same sidebar + folder-grid layout as the guidance desk.
 * Filing happens in Chat with Bama (New record button).
 */
export default function TeacherAnecdotalPage() {
  const recordsQuery = useQuery({
    queryKey: ["anecdotal-mine"],
    queryFn: fetchMyRecords,
    retry: false,
    staleTime: 60_000,
  });
  const records = recordsQuery.data ?? [];

  // The panel inherits the sidebar stack's accumulated height exactly
  // The panel inherits the sidebar stack's accumulated height exactly:
  // measure the inner content stack (never the stretched grid item, which
  // can only ratchet upward) and pin the main column to it — the folder
  // grid scrolls inside. Disabled on mobile where the columns stack.
  const sideRef = React.useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = React.useState<number | null>(null);

  React.useEffect(() => {
    const el = sideRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      if (window.innerWidth < 900) {
        setPanelHeight(null);
        return;
      }
      const h = el.offsetHeight;
      setPanelHeight((prev) => (prev === h ? prev : h));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  });

  if (recordsQuery.isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading filed records">
        <div className={styles.layout}>
          <aside className={styles.side}>
            <div ref={sideRef} className={styles.sideInner}>
            <div className={styles.skelCard} aria-hidden>
              <Skeleton className={styles.skelCardTitle} />
              <Skeleton className={styles.skelCardDesc} />
              <Skeleton className={styles.skelDonut} />
              <div className={styles.skelLegend}>
                {[0, 1, 2, 3, 4].map((j) => (
                  <div key={j} className={styles.skelLegendRow}>
                    <Skeleton className={styles.skelLegendDot} />
                    <Skeleton className={styles.skelLegendCount} />
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.skelCard} aria-hidden>
              <Skeleton className={styles.skelCardTitle} />
              <Skeleton className={styles.skelCardDesc} />
              <Skeleton className={styles.skelBar} />
              <Skeleton className={styles.skelBar} />
            </div>
            </div>
          </aside>
          <div className={styles.main} style={panelHeight ? { height: panelHeight } : undefined}>
            <div className={styles.skelPanel} aria-hidden>
              <Skeleton className={styles.skelPanelTitle} />
              <Skeleton className={styles.skelPanelDesc} />
              <div className={styles.skelActions}>
                <Skeleton className={styles.skelSearch} />
                <Skeleton className={styles.skelDrop} />
                <Skeleton className={styles.skelBtn} />
              </div>
              <div className={styles.skelFolderGrid}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i}>
                    <Skeleton className={styles.skelFolder} />
                    <Skeleton className={styles.skelFolderLabel} />
                    <Skeleton className={styles.skelFolderSub} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (recordsQuery.isError) {
    return (
      <section className={styles.page}>
        <p className={styles.error}>
          Your filed records could not be loaded. Check your connection and try again.
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Button
            size="sm"
            variant="outline"
            disabled={recordsQuery.isRefetching}
            onClick={() => recordsQuery.refetch()}
          >
            {recordsQuery.isRefetching ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : null}
            {recordsQuery.isRefetching ? "Retrying…" : "Try again"}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.layout}>
        <aside className={styles.side}>
          <div ref={sideRef} className={styles.sideInner}>
          <AnecdotalRepoSidebar records={records} />
          </div>
        </aside>
        <div className={styles.main} style={panelHeight ? { height: panelHeight } : undefined}>
          <AnecdotalRepoFolders records={records} />
        </div>
      </div>
    </section>
  );
}
