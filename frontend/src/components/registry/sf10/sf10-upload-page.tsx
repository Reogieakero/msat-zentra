"use client";

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Clock, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Skeleton } from "@/components/ui/skeleton";
import { Sf10UploadPanel } from "@/components/registry/sf10/Sf10UploadPanel";
import { Sf10RecordOverlay } from "@/components/registry/sf10/Sf10RecordOverlay";
import { Sf10RecordKanbanGrid } from "@/components/registry/sf10/sf10-folders";
import { fetchSf10Records, type Sf10ListResult } from "@/services/registry/sf10.service";
import styles from "@/components/registry/sf10/sf10.module.css";

const LATEST_TAKE = 5;

export function Sf10UploadPage({ desk }: { desk: "registrar" | "record-keeper" }) {
  const qc = useQueryClient();
  const [openRecordId, setOpenRecordId] = React.useState<string | null>(null);
  const [filedIds, setFiledIds] = React.useState<string[]>([]);
  const lastId = filedIds.length > 0 ? filedIds[filedIds.length - 1] : null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: [`${desk}-sf10`] });
    qc.invalidateQueries({ queryKey: [`${desk}-overview`] });
    qc.invalidateQueries({ queryKey: [`${desk}-notifications`] });
  };

  const latestQuery = useQuery<Sf10ListResult>({
    queryKey: [`${desk}-sf10`, "latest", LATEST_TAKE],
    queryFn: ({ signal }) => fetchSf10Records({ page: 1, pageSize: LATEST_TAKE, signal }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const latest = latestQuery.data?.records ?? [];
  const openRecord = (r: { id: string }) => {
    setOpenRecordId(r.id);
  };

  return (
    <section className={styles.page}>
      <div className={styles.stack}>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className={styles.emptyStack}>
            <Sf10UploadPanel
              onChanged={refresh}
              onUploaded={(id) => setFiledIds((prev) => [...prev, id])}
            />
            {lastId ? (
              <section className="rounded-xl border border-border p-2.5" aria-label="Filed records">
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FolderOpen className="size-3.5" aria-hidden />
                    {filedIds.length === 1 ? "1 record filed — open the folder to watch it being read." : `${filedIds.length} records filed — open the latest folder to watch it being read.`}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setOpenRecordId(lastId)}
                  >
                    View latest
                    <ArrowRight size={14} aria-hidden />
                  </Button>
                </div>
              </section>
            ) : null}
          </div>
        </div>

        {latestQuery.isPending || latest.length > 0 ? (
          <KanbanBoard
            title="Latest files"
            icon={<Clock size={14} className="text-amber-500" aria-hidden />}
            ariaLabel="Latest files"
            description={`The ${LATEST_TAKE} most recently filed records — open a folder to read it.`}
            actions={
              <Button asChild variant="default" size="sm" className="h-6 px-2 text-xs">
                <Link href={`/${desk}/sf10`}>View all</Link>
              </Button>
            }
          >
            {latestQuery.isPending ? (
              <div className={styles.folderKanbanGrid} aria-hidden="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className={styles.folderKanbanSkel} />
                ))}
              </div>
            ) : (
              <Sf10RecordKanbanGrid records={latest} onOpen={openRecord} />
            )}
          </KanbanBoard>
        ) : null}
      </div>
      <Sf10RecordOverlay
        desk={desk}
        recordId={openRecordId}
        onClose={() => setOpenRecordId(null)}
      />
    </section>
  );
}
