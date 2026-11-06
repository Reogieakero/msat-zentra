"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FolderOpen } from "lucide-react";
import { AnecdotalRecordKanbanCard } from "@/components/anecdotal/anecdotal-record-kanban-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderCard } from "@/components/ui/FolderCard";
import { Sf10RecordOverlay } from "@/components/registry/sf10/Sf10RecordOverlay";
import {
  fetchRecordKeeperOverview,
  fetchRegistrarOverview,
  type RegistryDesk,
} from "@/services/registry/overview.service";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./Sf10AttachFeed.module.css";

const GRID_COLUMN_GAP = 8;
const FEED_CAP = 100;
// Glow variant fills two rows of bare folders; the kanban variant (record
// keeper) always shows just the latest three shareable folder cards.
const GLOW_MIN_COLUMN = 140;
const KANBAN_FEED_LIMIT = 3;
// Amber — the folder accent (folder + file icon) on the folder cards.
const SF10_FOLDER_COLOR = "#f59e0b";

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

export function Sf10AttachFeed({
  desk,
  variant = "glow",
}: {
  desk: RegistryDesk;
  /**
   * "glow" (default) — legacy registry glow card with bare folders.
   * "kanban" — kanban shell; each record is a shareable folder card with
   * the same design as the teacher anecdotal folders.
   */
  variant?: "glow" | "kanban";
}) {
  const kanban = variant === "kanban";
  const router = useRouter();
  // SF10 record whose report overlay is open (kanban feed). The sf10 board
  // at /{desk}/sf10 opens the same overlay from its folder cards.
  const [openRecordId, setOpenRecordId] = React.useState<string | null>(null);
  const { data, isPending, isError } = useQuery({
    queryKey: [`${desk}-overview`],
    queryFn: desk === "registrar" ? fetchRegistrarOverview : fetchRecordKeeperOverview,
    staleTime: 30_000,
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

  const visible = React.useMemo(() => {
    if (kanban) return feed.slice(0, KANBAN_FEED_LIMIT);
    if (rowWidth <= 0) return feed.slice(0, 2);
    const columns = Math.max(
      1,
      Math.floor((rowWidth + GRID_COLUMN_GAP) / (GLOW_MIN_COLUMN + GRID_COLUMN_GAP))
    );
    return feed.slice(0, columns * 2);
  }, [kanban, feed, rowWidth]);

  const goSf10 = React.useCallback(() => {
    router.push(`/${desk}/sf10`);
  }, [router, desk]);

  const isEmpty = !isPending && !isError && feed.length === 0;
  // Desk-aware band label — record keeper covers G7–10, registrar G11–12.
  const bandLabel = desk === "registrar" ? "G11–12" : "G7–10";
  const description = `Most recent SF10 records pulled into ${bandLabel} student files this term.`;

  const body = isPending ? (
    <div className={kanban ? styles.kanbanGrid : styles.skelWrap}>
      {Array.from({ length: kanban ? KANBAN_FEED_LIMIT : 6 }).map((_, i) => (
        <Skeleton
          key={i}
          className={kanban ? styles.skelFolderKanban : styles.skelFolder}
        />
      ))}
    </div>
  ) : isError ? (
    <p className={styles.empty}>Could not load the attach feed.</p>
  ) : feed.length === 0 ? (
    <div className={styles.emptyBlock}>
      <span className={styles.emptyIcon} aria-hidden>
        <FolderOpen />
      </span>
      <p className={styles.emptyTitle}>No files attached yet</p>
      <p className={styles.emptyHint}>
        SF10 records appear here once they are pulled into student files.
      </p>
    </div>
  ) : (
    <div ref={gridRef} className={kanban ? styles.kanbanGrid : styles.folderGrid}>
      {visible.map((f) =>
        kanban ? (
          <AnecdotalRecordKanbanCard
            key={`${f.lrn}-${f.when}`}
            category="sf10"
            headerTitle="SF10 Record"
            studentName={f.student}
            metaText={f.lrn}
            fileName={`SF10_${f.lrn}.pdf`}
            fileTag={`${f.grade} • ${timeAgo(f.when)}`}
            categoryColor={SF10_FOLDER_COLOR}
            folderColor={SF10_FOLDER_COLOR}
            tone={3}
            openLabel={`Open ${f.student}'s SF10 record`}
            onOpen={() => {
              // Overlay the record report in place — same card behavior as
              // the SF10 board. Legacy payloads without an id fall back to
              // the list (which opens the overlay from there).
              if (f.id) setOpenRecordId(f.id);
              else goSf10();
            }}
          />
        ) : (
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
        )
      )}
    </div>
  );

  if (kanban) {
    return (
      <>
        <section
          className={styles.kanbanSection}
          aria-label="Latest SF10 files attached"
        >
          <div className={styles.kanbanHeader}>
            <div className={styles.kanbanHeaderText}>
              <h2 className="text-base font-semibold">Latest SF10 Files Attached</h2>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
            {feed.length > 0 && (
              <Link
                href={`/${desk}/sf10`}
                className="shrink-0 text-xs font-medium text-amber-700 underline-offset-4 hover:underline dark:text-amber-400"
              >
                View all attachments
              </Link>
            )}
          </div>
          <div className={styles.kanbanBody}>{body}</div>
        </section>
        <Sf10RecordOverlay
          desk={desk}
          recordId={openRecordId}
          onClose={() => setOpenRecordId(null)}
        />
      </>
    );
  }

  return (
    <section className={assign.card} aria-labelledby={isEmpty ? undefined : "overview-sf10-feed"}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      {!isEmpty && (
        <div className={`${styles.header} relative`}>
          <div className={styles.headerText}>
            <h2 id="overview-sf10-feed" className="text-base font-semibold">
              Latest SF10 Files Attached
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      )}
      <div className={`${styles.content} relative`}>{body}</div>
      {feed.length > 0 && (
        <div className={`${styles.footer} relative`}>
          <Button className={styles.footerBtn} onClick={goSf10}>
            View all attachments
          </Button>
        </div>
      )}
    </section>
  );
}
