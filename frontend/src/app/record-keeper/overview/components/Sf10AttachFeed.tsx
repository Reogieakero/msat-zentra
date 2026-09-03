"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderCard } from "@/components/ui/FolderCard";
import { fetchRecordKeeperOverview } from "./overview-data";
import styles from "./Sf10AttachFeed.module.css";

const GRID_MIN_COLUMN = 140;
const GRID_COLUMN_GAP = 8;
const FEED_CAP = 100;

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then) || then < Date.UTC(2000, 0, 1)) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function Sf10AttachFeed() {
  const router = useRouter();
  const { data, isPending, isError } = useQuery({
    queryKey: ["record-keeper-overview"],
    queryFn: fetchRecordKeeperOverview,
  });

  const feed = React.useMemo(
    () => (data?.latestAttachments ?? []).slice(0, FEED_CAP),
    [data]
  );

  const gridRef = React.useRef<HTMLDivElement | null>(null);
  const [rowWidth, setRowWidth] = React.useState(0);

  React.useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const compute = () => setRowWidth(el.clientWidth);
    compute();
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(compute) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [isPending]);

  // No fixed count: the number of columns comes from the container width, so the
  // feed adapts to mobile while always filling exactly two complete rows.
  const visible = React.useMemo(() => {
    if (rowWidth <= 0) return feed.slice(0, 2);
    const columns = Math.max(
      1,
      Math.floor((rowWidth + GRID_COLUMN_GAP) / (GRID_MIN_COLUMN + GRID_COLUMN_GAP))
    );
    return feed.slice(0, columns * 2);
  }, [feed, rowWidth]);

  const goSf10 = React.useCallback(() => {
    router.push("/record-keeper/sf10");
  }, [router]);

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <CardTitle>Latest SF10 Files Attached</CardTitle>
          <CardDescription>
            Most recent SF10 records pulled into G7–10 student files this term.
          </CardDescription>
        </div>
        <CardAction>
          <Badge variant="warning" className={styles.attachBadge}>
            {isPending ? "…" : data?.sf10.attach ?? 0}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className={styles.content}>
        {isPending ? (
          <div className={styles.skelWrap}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className={styles.skelFolder} />
            ))}
          </div>
        ) : isError ? (
          <p className={styles.empty}>Could not load the attach feed.</p>
        ) : feed.length === 0 ? (
          <p className={styles.empty}>No SF10 files attached yet.</p>
        ) : (
          <div className={styles.folderGrid} ref={gridRef}>
            {visible.map((f) => (
              <div key={`${f.lrn}-${f.when}`} className={styles.feedItem}>
                <FolderCard
                  label={f.student}
                  sublabel={f.lrn}
                  files={[
                    {
                      name: `SF10_${f.lrn}.pdf`,
                      tag: `${f.grade} • ${timeAgo(f.when)}`,
                      tone: 3,
                      icon: "doc",
                    },
                  ]}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className={styles.footer}>
        <Button className={styles.footerBtn} onClick={goSf10}>
          View all attachments
        </Button>
      </CardFooter>
    </Card>
  );
}