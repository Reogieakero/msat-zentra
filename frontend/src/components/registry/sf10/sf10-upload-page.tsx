"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sf10UploadPanel } from "@/components/registry/sf10/Sf10UploadPanel";
import { Sf10FolderGrid } from "@/components/registry/sf10/sf10-folders";
import { RecordKeeperPageHeader } from "@/app/record-keeper/components/RecordKeeperPageHeader";
import { RegistrarPageHeader } from "@/app/registrar/components/RegistrarPageHeader";
import { fetchSf10Records, type Sf10ListResult } from "@/services/registry/sf10.service";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "@/components/registry/sf10/sf10.module.css";

const LATEST_TAKE = 10;

export function Sf10UploadPage({ desk }: { desk: "registrar" | "record-keeper" }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [filedIds, setFiledIds] = React.useState<string[]>([]);
  const lastId = filedIds.length > 0 ? filedIds[filedIds.length - 1] : null;
  const DeskPageHeader = desk === "registrar" ? RegistrarPageHeader : RecordKeeperPageHeader;

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
    router.push(`/${desk}/sf10/${r.id}`);
  };

  return (
    <section className={styles.page}>
      <div className={styles.stack}>
        <DeskPageHeader
          title="Upload SF10"
          description="Attach the SF10 file — the learner, subjects, and grade level are read from the file first, then filed automatically under this desk."
        />
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className={styles.emptyStack}>
          <Sf10UploadPanel
            onChanged={refresh}
            onUploaded={(id) => setFiledIds((prev) => [...prev, id])}
          />
          {lastId ? (
            <section className={assign.card} aria-label="Filed records">
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FolderOpen className="size-4" aria-hidden />
                  {filedIds.length === 1 ? "1 record filed — open the folder to watch it being read." : `${filedIds.length} records filed — open the latest folder to watch it being read.`}
                </p>
                <Button asChild size="sm">
                  <Link href={`/${desk}/sf10/${lastId}`}>
                    View latest
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </div>
            </section>
          ) : null}
          </div>
        </div>

        {latestQuery.isPending || latest.length > 0 ? (
          <section aria-labelledby="sf10-latest">
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="sf10-latest" className="text-base font-semibold">
                  Latest files
                </h2>
                <Button asChild variant="default" size="sm" className="h-8">
                  <Link href={`/${desk}/sf10`}>
                    View all
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                The {LATEST_TAKE} most recently filed records — open a folder to read it.
              </p>
            </div>
            <div className="relative mt-3">
              {latestQuery.isPending ? (
                <div className={styles.folderGrid} aria-hidden="true">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-44 w-full rounded-xl" />
                  ))}
                </div>
              ) : (
                <Sf10FolderGrid records={latest} onOpen={openRecord} />
              )}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}
