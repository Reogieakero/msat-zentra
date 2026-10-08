"use client";

import * as React from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, CheckCircle2, Archive, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { StatusBadge, formatRelativeTime } from "@/components/registry/sf10/shared";
import { GRADE_LABEL, SF10_SOURCE_LABEL, type Sf10Record } from "@/services/registry/sf10.types";
import { validateSf10, releaseSf10, fetchSf10Versions } from "@/services/registry/sf10.service";
import { markSelfNotified } from "@/lib/realtime/recordKeeperChannel";
import styles from "@/components/registry/sf10/sf10.module.css";

export function Sf10DetailSheet({
  record,
  open,
  onOpenChange,
  onChanged,
}: {
  record: Sf10Record | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const [acting, setActing] = React.useState<"validate" | "release" | null>(null);
  const queryClient = useQueryClient();

  const versionsQuery = useQuery({
    queryKey: ["sf10-versions", record?.id ?? null],
    queryFn: ({ signal }) => fetchSf10Versions(record!.id, signal),
    enabled: open && record !== null,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
  const versions = versionsQuery.data ?? record?.versions ?? [];

  if (!record) return null;

  const refreshVersions = () => {
    if (record) {
      void queryClient.invalidateQueries({ queryKey: ["sf10-versions", record.id] });
    }
  };

  const handleValidate = async () => {
    setActing("validate");
    try {
      await validateSf10(record.id);
      markSelfNotified(record.id);
      toast.success({ title: "Validated", description: `${record.fullName} marked available.` });
      refreshVersions();
      onChanged?.();
      onOpenChange(false);
    } catch {
      toast.error({ title: "Validation failed" });
    } finally {
      setActing(null);
    }
  };

  const handleRelease = async () => {
    setActing("release");
    try {
      await releaseSf10(record.id);
      markSelfNotified(record.id);
      toast.success({ title: "Released", description: `${record.fullName} released & archived.` });
      refreshVersions();
      onChanged?.();
      onOpenChange(false);
    } catch {
      toast.error({ title: "Release failed" });
    } finally {
      setActing(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{record.fullName}</SheetTitle>
          <SheetDescription className={styles.lrn}>{record.lrn}</SheetDescription>
        </SheetHeader>

        <div className={styles.sheetBody}>
          <div className="flex items-center gap-2">
            <StatusBadge status={record.status} />
            <span className={styles.muted}>
              {GRADE_LABEL[record.gradeLevel]} · {record.section} ·{" "}
              {SF10_SOURCE_LABEL[record.source]}
            </span>
          </div>

          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Uploaded</span>
              <span className={styles.metaValue}>{formatRelativeTime(record.uploadedAt)}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Verified by</span>
              <span className={styles.metaValue}>{record.verifiedBy ?? "—"}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Validated by</span>
              <span className={styles.metaValue}>{record.validatedBy ?? "—"}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Released</span>
              <span className={styles.metaValue}>{formatRelativeTime(record.releasedAt)}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Current version</span>
              <span className={styles.metaValue}>v{record.currentVersion}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Last updated</span>
              <span className={styles.metaValue}>{formatRelativeTime(record.updatedAt)}</span>
            </div>
          </div>

          {record.uploadedFileUrl ? (
            <Button asChild variant="outline" size="sm" className="w-fit">
              <a href={record.uploadedFileUrl} target="_blank" rel="noreferrer noopener">
                <ExternalLink />
                Open SF10 file
              </a>
            </Button>
          ) : null}

          <div>
            <p className={styles.sectionLabel}>Version history</p>
            {versionsQuery.isPending ? (
              <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading version history">
                {[0, 1].map((i) => (
                  <Skeleton key={i} style={{ width: `${90 - i * 15}%`, height: "0.875rem" }} />
                ))}
              </div>
            ) : (
              <div className={styles.timeline}>
                {versions.map((v) => (
                  <div key={v.versionNumber} className={styles.timelineRow}>
                    <span>
                      <span className={styles.name}>v{v.versionNumber}</span>{" "}
                      <span className={styles.timelineReason}>— {v.changeReason}</span>
                    </span>
                    <span className={styles.muted}>{formatRelativeTime(v.changedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.sheetActions}>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={record.status !== "attach" || acting !== null}
            aria-busy={(acting === "validate") || undefined}
            onClick={handleValidate}
          >
            {acting === "validate" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 />
            )}
            {acting === "validate" ? "Validating…" : "Validate"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={record.status !== "available" || acting !== null}
            aria-busy={(acting === "release") || undefined}
            onClick={handleRelease}
          >
            {acting === "release" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Archive />
            )}
            {acting === "release" ? "Releasing…" : "Release & archive"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
